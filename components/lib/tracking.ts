/**
 * Longtail AI Ventures - Tracking Library
 * 
 * Copy this file into your venture's lib/ folder.
 * Add VENTURE_STUDIO_URL to your .env file.
 * 
 * Usage:
 *   import { trackSignup, trackSubscription, trackPayment, trackChurn } from '@/lib/tracking'
 *   
 *   // On user signup
 *   await trackSignup({ email: 'user@example.com', plan: 'free' })
 *   
 *   // On subscription created
 *   await trackSubscription({ email: 'user@example.com', plan: 'pro', amount: 49 })
 */

// Configure your venture slug here
const VENTURE_SLUG = process.env.NEXT_PUBLIC_VENTURE_SLUG || 'your-venture-slug'
const DASHBOARD_URL = process.env.VENTURE_STUDIO_URL || 'https://longtail-ai-ventures.vercel.app'

interface TrackingPayload {
  venture: string
  event: string
  email?: string
  name?: string
  plan?: string
  amount?: number
  currency?: string
  status?: string
  source?: string
  metadata?: Record<string, any>
}

async function sendToTracker(payload: TrackingPayload): Promise<boolean> {
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('Tracking failed:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Tracking error:', error)
    return false
  }
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

/**
 * Track a new user signup
 */
export async function trackSignup(data: {
  email: string
  name?: string
  plan?: string
  source?: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'signup',
    email: data.email,
    name: data.name,
    plan: data.plan || 'free',
    source: data.source,
    metadata: data.metadata,
  })
}

/**
 * Track a subscription creation or update
 */
export async function trackSubscription(data: {
  email: string
  plan: string
  amount?: number
  currency?: string
  status?: 'trial' | 'active' | 'canceled' | 'past_due'
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'subscription',
    email: data.email,
    plan: data.plan,
    amount: data.amount,
    currency: data.currency || 'USD',
    status: data.status || 'active',
    metadata: data.metadata,
  })
}

/**
 * Track a payment/revenue event
 */
export async function trackPayment(data: {
  amount: number
  email?: string
  currency?: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'payment',
    amount: data.amount,
    email: data.email,
    currency: data.currency || 'USD',
    metadata: data.metadata,
  })
}

/**
 * Track customer churn
 */
export async function trackChurn(data: {
  email: string
  reason?: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'churn',
    email: data.email,
    metadata: { reason: data.reason, ...data.metadata },
  })
}

/**
 * Track trial start
 */
export async function trackTrialStart(data: {
  email: string
  plan: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'trial_start',
    email: data.email,
    plan: data.plan,
    status: 'trial',
    metadata: data.metadata,
  })
}

/**
 * Track trial end (conversion or churn)
 */
export async function trackTrialEnd(data: {
  email: string
  converted: boolean
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: 'trial_end',
    email: data.email,
    status: data.converted ? 'active' : 'churned',
    metadata: data.metadata,
  })
}

/**
 * Generic event tracking
 */
export async function trackEvent(data: {
  event: string
  email?: string
  plan?: string
  amount?: number
  status?: string
  metadata?: Record<string, any>
}): Promise<boolean> {
  return sendToTracker({
    venture: VENTURE_SLUG,
    event: data.event,
    email: data.email,
    plan: data.plan,
    amount: data.amount,
    status: data.status,
    metadata: data.metadata,
  })
}

// ============================================
// STRIPE WEBHOOK HELPER
// ============================================

/**
 * Helper to forward Stripe webhook events to the dashboard
 * Call this from your Stripe webhook handler
 */
export async function forwardStripeEvent(event: any): Promise<boolean> {
  const type = event.type
  const data = event.data.object

  switch (type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const email = data.customer_email || data.metadata?.email
      if (!email) return false
      
      return trackSubscription({
        email,
        plan: data.items?.data[0]?.price?.product?.name || 'paid',
        amount: (data.items?.data[0]?.price?.unit_amount || 0) / 100,
        status: data.status,
      })
    }

    case 'customer.subscription.deleted': {
      const email = data.customer_email || data.metadata?.email
      if (!email) return false
      
      return trackChurn({ email, reason: 'subscription_canceled' })
    }

    case 'invoice.paid': {
      const email = data.customer_email
      const amount = data.amount_paid / 100
      
      return trackPayment({ amount, email })
    }

    case 'customer.subscription.trial_will_end': {
      const email = data.customer_email || data.metadata?.email
      if (!email) return false
      
      return trackEvent({
        event: 'trial_ending',
        email,
        metadata: { days_remaining: 3 },
      })
    }

    default:
      // Log other events generically
      return trackEvent({
        event: `stripe_${type}`,
        email: data.customer_email || data.email,
        metadata: { stripe_event_id: event.id },
      })
  }
}
