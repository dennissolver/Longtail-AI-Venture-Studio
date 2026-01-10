import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { createSupabaseServer, isSuperadmin } from '@/lib/supabase-server'
import Stripe from 'stripe'

// POST /api/stripe/sync?venture=tourlingo
// Syncs all Stripe data for a venture
export async function POST(request: NextRequest) {
  // Check auth
  const isAdmin = await isSuperadmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ventureSlug = request.nextUrl.searchParams.get('venture')
  if (!ventureSlug) {
    return NextResponse.json({ error: 'Missing venture parameter' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Get venture
  const { data: venture, error: ventureError } = await supabase
    .from('ventures')
    .select('id, stripe_secret_key')
    .eq('slug', ventureSlug)
    .single()

  if (ventureError || !venture?.stripe_secret_key) {
    return NextResponse.json({ error: 'Venture not found or Stripe not configured' }, { status: 404 })
  }

  const stripe = new Stripe(venture.stripe_secret_key, { apiVersion: '2025-02-24.acacia' })

  try {
    // Sync products
    const products = await stripe.products.list({ limit: 100, active: true })
    for (const product of products.data) {
      await supabase
        .from('plans')
        .upsert({
          venture_id: venture.id,
          stripe_product_id: product.id,
          name: product.name,
          description: product.description,
          features: product.features?.map(f => f.name) || [],
          is_active: product.active,
        }, { onConflict: 'stripe_product_id' })
    }

    // Sync prices
    const prices = await stripe.prices.list({ limit: 100, active: true })
    for (const price of prices.data) {
      const { data: plan } = await supabase
        .from('plans')
        .select('id')
        .eq('stripe_product_id', price.product as string)
        .eq('venture_id', venture.id)
        .single()

      await supabase
        .from('prices')
        .upsert({
          venture_id: venture.id,
          plan_id: plan?.id,
          stripe_price_id: price.id,
          amount: (price.unit_amount || 0) / 100,
          currency: price.currency.toUpperCase(),
          interval: price.recurring?.interval || 'one_time',
          interval_count: price.recurring?.interval_count || 1,
          is_active: price.active,
        }, { onConflict: 'stripe_price_id' })
    }

    // Sync subscriptions
    const subscriptions = await stripe.subscriptions.list({ limit: 100, status: 'all' })
    for (const subscription of subscriptions.data) {
      const priceId = subscription.items.data[0]?.price.id

      const { data: priceRecord } = await supabase
        .from('prices')
        .select('id')
        .eq('stripe_price_id', priceId)
        .eq('venture_id', venture.id)
        .single()

      // Get customer email
      let customerEmail = null
      try {
        const customer = await stripe.customers.retrieve(subscription.customer as string)
        if (customer && !customer.deleted) {
          customerEmail = (customer as Stripe.Customer).email
        }
      } catch (e) {
        // Customer might be deleted
      }

      // Find signup by email
      let signupId = null
      if (customerEmail) {
        const { data: signup } = await supabase
          .from('signups')
          .select('id')
          .eq('venture_id', venture.id)
          .eq('email', customerEmail)
          .single()
        signupId = signup?.id

        // Create signup if doesn't exist
        if (!signupId) {
          const { data: newSignup } = await supabase
            .from('signups')
            .insert({
              venture_id: venture.id,
              email: customerEmail,
              plan: 'paid',
              status: subscription.status === 'active' ? 'active' : subscription.status,
              source: 'stripe_sync',
            })
            .select('id')
            .single()
          signupId = newSignup?.id
        }
      }

      await supabase
        .from('subscriptions')
        .upsert({
          venture_id: venture.id,
          signup_id: signupId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          price_id: priceRecord?.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })
    }

    // Sync recent charges as revenue
    const charges = await stripe.charges.list({ limit: 100 })
    for (const charge of charges.data) {
      if (charge.status !== 'succeeded') continue

      // Check if already recorded
      const { data: existing } = await supabase
        .from('revenue')
        .select('id')
        .eq('stripe_payment_id', charge.id)
        .single()

      if (!existing) {
        const customerEmail = charge.billing_details?.email || charge.receipt_email

        const { data: signup } = await supabase
          .from('signups')
          .select('id')
          .eq('venture_id', venture.id)
          .eq('email', customerEmail)
          .single()

        await supabase.from('revenue').insert({
          venture_id: venture.id,
          signup_id: signup?.id,
          amount: charge.amount / 100,
          currency: charge.currency.toUpperCase(),
          type: 'subscription',
          stripe_payment_id: charge.id,
          created_at: new Date(charge.created * 1000).toISOString(),
        })
      }
    }

    return NextResponse.json({
      success: true,
      synced: {
        products: products.data.length,
        prices: prices.data.length,
        subscriptions: subscriptions.data.length,
        charges: charges.data.length,
      }
    })
  } catch (error: any) {
    console.error('Stripe sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/stripe/sync?venture=tourlingo
// Get current Stripe sync status
export async function GET(request: NextRequest) {
  const isAdmin = await isSuperadmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ventureSlug = request.nextUrl.searchParams.get('venture')
  if (!ventureSlug) {
    return NextResponse.json({ error: 'Missing venture parameter' }, { status: 400 })
  }

  const supabase = await createSupabaseServer()

  const { data: venture } = await supabase
    .from('ventures')
    .select('id, stripe_secret_key')
    .eq('slug', ventureSlug)
    .single()

  if (!venture) {
    return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
  }

  // Get counts
  const { count: plansCount } = await supabase
    .from('plans')
    .select('*', { count: 'exact', head: true })
    .eq('venture_id', venture.id)

  const { count: pricesCount } = await supabase
    .from('prices')
    .select('*', { count: 'exact', head: true })
    .eq('venture_id', venture.id)

  const { count: subscriptionsCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('venture_id', venture.id)
    .eq('status', 'active')

  return NextResponse.json({
    configured: !!venture.stripe_secret_key,
    plans: plansCount || 0,
    prices: pricesCount || 0,
    activeSubscriptions: subscriptionsCount || 0,
  })
}