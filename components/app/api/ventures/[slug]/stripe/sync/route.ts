import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import Stripe from 'stripe'

// POST /api/ventures/[slug]/stripe/sync - Sync data from Stripe
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createSupabaseServer()

    // Get venture with Stripe key
    const { data: venture, error: ventureError } = await supabase
      .from('ventures')
      .select('id, stripe_secret_key')
      .eq('slug', slug)
      .single()

    if (ventureError || !venture) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    if (!venture.stripe_secret_key) {
      return NextResponse.json({ error: 'Stripe not configured for this venture' }, { status: 400 })
    }

    // Initialize Stripe client
    const stripe = new Stripe(venture.stripe_secret_key, {
      apiVersion: '2025-02-24.acacia',
    })

    const ventureId = venture.id
    let plansCount = 0
    let pricesCount = 0
    let subscriptionsCount = 0

    // Sync Products (as Plans)
    const products = await stripe.products.list({ active: true, limit: 100 })
    
    for (const product of products.data) {
      const { error: planError } = await supabase
        .from('plans')
        .upsert({
          id: product.id,
          venture_id: ventureId,
          stripe_product_id: product.id,
          name: product.name,
          description: product.description,
          features: (product.metadata?.features ? JSON.parse(product.metadata.features) : []),
          is_active: product.active,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })

      if (!planError) plansCount++
    }

    // Sync Prices
    const prices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })
    
    for (const price of prices.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product.id
      
      const { error: priceError } = await supabase
        .from('prices')
        .upsert({
          id: price.id,
          venture_id: ventureId,
          plan_id: productId,
          stripe_price_id: price.id,
          amount: (price.unit_amount || 0) / 100, // Convert cents to dollars
          currency: price.currency.toUpperCase(),
          interval: price.recurring?.interval || 'one_time',
          interval_count: price.recurring?.interval_count || 1,
          is_active: price.active,
          is_default: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })

      if (!priceError) pricesCount++
    }

    // Sync Subscriptions
    const subscriptions = await stripe.subscriptions.list({ limit: 100, expand: ['data.customer'] })
    
    for (const subscription of subscriptions.data) {
      const customer = subscription.customer as Stripe.Customer
      const customerEmail = typeof customer === 'object' ? customer.email : null
      const priceId = subscription.items.data[0]?.price.id

      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          id: subscription.id,
          venture_id: ventureId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id,
          price_id: priceId,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          canceled_at: subscription.canceled_at 
            ? new Date(subscription.canceled_at * 1000).toISOString() 
            : null,
          trial_start: subscription.trial_start 
            ? new Date(subscription.trial_start * 1000).toISOString() 
            : null,
          trial_end: subscription.trial_end 
            ? new Date(subscription.trial_end * 1000).toISOString() 
            : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })

      if (!subError) {
        subscriptionsCount++

        // Also update/create signup record
        if (customerEmail) {
          const plan = subscription.items.data[0]?.price.product
          const planName = typeof plan === 'object' ? plan.name : 'paid'

          await supabase
            .from('signups')
            .upsert({
              venture_id: ventureId,
              email: customerEmail,
              plan: planName || 'paid',
              status: subscription.status === 'active' ? 'active' 
                : subscription.status === 'trialing' ? 'trial'
                : subscription.status === 'canceled' ? 'churned'
                : subscription.status,
              source: 'stripe',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'venture_id,email',
              ignoreDuplicates: false,
            })
        }
      }
    }

    // Log sync event
    await supabase.from('events').insert({
      venture_id: ventureId,
      type: 'stripe_sync',
      data: { plans: plansCount, prices: pricesCount, subscriptions: subscriptionsCount },
    })

    return NextResponse.json({
      success: true,
      plans: plansCount,
      prices: pricesCount,
      subscriptions: subscriptionsCount,
    })
  } catch (error: any) {
    console.error('Stripe sync error:', error)
    
    // Check for Stripe-specific errors
    if (error.type === 'StripeAuthenticationError') {
      return NextResponse.json({ error: 'Invalid Stripe API key' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    )
  }
}
