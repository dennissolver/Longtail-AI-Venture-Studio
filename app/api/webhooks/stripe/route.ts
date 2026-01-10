import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Get venture from query param (each venture has unique webhook URL)
  const ventureSlug = request.nextUrl.searchParams.get('venture')

  if (!ventureSlug) {
    return NextResponse.json({ error: 'Missing venture parameter' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Get venture and its Stripe keys
  const { data: venture, error: ventureError } = await supabase
    .from('ventures')
    .select('id, stripe_secret_key, stripe_webhook_secret')
    .eq('slug', ventureSlug)
    .single()

  if (ventureError || !venture?.stripe_secret_key) {
    return NextResponse.json({ error: 'Venture not found or Stripe not configured' }, { status: 404 })
  }

  const stripe = new Stripe(venture.stripe_secret_key, { apiVersion: '2025-02-24.acacia' })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature!, venture.stripe_webhook_secret!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(supabase, venture.id, event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, venture.id, event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(supabase, venture.id, event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, venture.id, event.data.object as Stripe.Invoice)
        break

      case 'product.created':
      case 'product.updated':
        await handleProductChange(supabase, venture.id, event.data.object as Stripe.Product)
        break

      case 'price.created':
      case 'price.updated':
        await handlePriceChange(supabase, venture.id, event.data.object as Stripe.Price)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleSubscriptionChange(supabase: any, ventureId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id

  // Find the price in our DB
  const { data: price } = await supabase
    .from('prices')
    .select('id')
    .eq('stripe_price_id', priceId)
    .eq('venture_id', ventureId)
    .single()

  // Find signup by customer email
  const customerEmail = (subscription.customer as any)?.email || subscription.metadata?.email
  let signupId = null

  if (customerEmail) {
    const { data: signup } = await supabase
      .from('signups')
      .select('id')
      .eq('venture_id', ventureId)
      .eq('email', customerEmail)
      .single()
    signupId = signup?.id
  }

  await supabase
    .from('subscriptions')
    .upsert({
      venture_id: ventureId,
      signup_id: signupId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      price_id: price?.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' })

  // Update signup status
  if (signupId) {
    await supabase
      .from('signups')
      .update({
        status: subscription.status === 'active' ? 'active' : subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', signupId)
  }

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'subscription_' + subscription.status,
    email: customerEmail,
    data: {
      stripe_subscription_id: subscription.id,
      status: subscription.status
    }
  })
}

async function handleSubscriptionDeleted(supabase: any, ventureId: string, subscription: Stripe.Subscription) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  // Find and update signup
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('signup_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (sub?.signup_id) {
    await supabase
      .from('signups')
      .update({ status: 'churned', updated_at: new Date().toISOString() })
      .eq('id', sub.signup_id)
  }

  // Log churn event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'churn',
    data: { stripe_subscription_id: subscription.id }
  })
}

async function handleInvoicePaid(supabase: any, ventureId: string, invoice: Stripe.Invoice) {
  if (invoice.amount_paid === 0) return

  const customerEmail = invoice.customer_email

  // Find signup
  const { data: signup } = await supabase
    .from('signups')
    .select('id')
    .eq('venture_id', ventureId)
    .eq('email', customerEmail)
    .single()

  // Record revenue
  await supabase.from('revenue').insert({
    venture_id: ventureId,
    signup_id: signup?.id,
    amount: invoice.amount_paid / 100, // Stripe uses cents
    currency: invoice.currency.toUpperCase(),
    type: invoice.billing_reason === 'subscription_create' ? 'subscription' : 'subscription',
    stripe_payment_id: invoice.payment_intent as string,
    stripe_subscription_id: invoice.subscription as string,
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().split('T')[0] : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString().split('T')[0] : null,
  })

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'payment',
    email: customerEmail,
    data: {
      amount: invoice.amount_paid / 100,
      currency: invoice.currency
    }
  })
}

async function handlePaymentFailed(supabase: any, ventureId: string, invoice: Stripe.Invoice) {
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'payment_failed',
    email: invoice.customer_email,
    data: {
      amount: invoice.amount_due / 100,
      subscription_id: invoice.subscription
    }
  })
}

async function handleProductChange(supabase: any, ventureId: string, product: Stripe.Product) {
  await supabase
    .from('plans')
    .upsert({
      venture_id: ventureId,
      stripe_product_id: product.id,
      name: product.name,
      description: product.description,
      features: product.features?.map(f => f.name) || [],
      is_active: product.active,
    }, { onConflict: 'stripe_product_id' })
}

async function handlePriceChange(supabase: any, ventureId: string, price: Stripe.Price) {
  // Find the plan
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('stripe_product_id', price.product as string)
    .eq('venture_id', ventureId)
    .single()

  await supabase
    .from('prices')
    .upsert({
      venture_id: ventureId,
      plan_id: plan?.id,
      stripe_price_id: price.id,
      amount: (price.unit_amount || 0) / 100,
      currency: price.currency.toUpperCase(),
      interval: price.recurring?.interval || 'one_time',
      interval_count: price.recurring?.interval_count || 1,
      is_active: price.active,
    }, { onConflict: 'stripe_price_id' })
}