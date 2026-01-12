import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import VentureDetailClient from '@/components/VentureDetailClient'

export const dynamic = 'force-dynamic'

export default async function VentureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createSupabaseServer()

  // Get venture (including stripe_secret_key to check if configured)
  const { data: venture, error } = await supabase
    .from('ventures')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !venture) {
    notFound()
  }

  // Get signups
  const { data: signups } = await supabase
    .from('signups')
    .select('*')
    .eq('venture_id', venture.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get revenue
  const { data: revenue } = await supabase
    .from('revenue')
    .select('*')
    .eq('venture_id', venture.id)
    .order('created_at', { ascending: false })

  // Get recent events
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('venture_id', venture.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get Stripe plans and prices (if synced)
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('venture_id', venture.id)
    .eq('is_active', true)

  const { data: prices } = await supabase
    .from('prices')
    .select('*')
    .eq('venture_id', venture.id)
    .eq('is_active', true)

  // Get subscription counts from Stripe data
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('venture_id', venture.id)

  // Calculate metrics
  const totalRevenue = (revenue || [])
    .filter((r: any) => r.type !== 'refund')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  const mrr = (revenue || [])
    .filter((r: any) => r.type === 'subscription')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  const signupsList = signups || []
  const totalSignups = signupsList.length
  const paidCustomers = signupsList.filter((s: any) => s.plan !== 'free').length
  const activeCustomers = signupsList.filter((s: any) => s.status === 'active').length
  const churnedCustomers = signupsList.filter((s: any) => s.status === 'churned').length

  // Plan distribution
  const planCounts: Record<string, number> = {}
  signupsList.forEach((s: any) => {
    planCounts[s.plan] = (planCounts[s.plan] || 0) + 1
  })
  const planDistribution = Object.entries(planCounts).map(([name, value]) => ({ name, value }))

  // Monthly revenue data (last 6 months)
  const months: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    months[key] = 0
  }
  (revenue || []).forEach((r: any) => {
    if (r.type === 'refund') return
    const date = new Date(r.created_at)
    const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (months[key] !== undefined) {
      months[key] += Number(r.amount)
    }
  })
  const monthlyRevenue = Object.entries(months).map(([month, Revenue]) => ({ month, Revenue }))

  // Calculate subscription counts from Stripe data
  const subscriptionCounts = {
    active: (subscriptions || []).filter((s: any) => s.status === 'active').length,
    trialing: (subscriptions || []).filter((s: any) => s.status === 'trialing').length,
    pastDue: (subscriptions || []).filter((s: any) => s.status === 'past_due').length,
    canceled: (subscriptions || []).filter((s: any) => s.status === 'canceled').length,
  }

  // Build pricing tiers from Stripe data
  const pricingTiers = (plans || []).map((plan: any) => {
    const planPrices = (prices || []).filter((p: any) => p.plan_id === plan.id)
    const monthlyPrice = planPrices.find((p: any) => p.interval === 'month')
    const yearlyPrice = planPrices.find((p: any) => p.interval === 'year')

    // Calculate subscribers needed for $1M ARR based on this plan's pricing
    const annualRevenue = monthlyPrice
      ? monthlyPrice.amount * 12
      : yearlyPrice
        ? yearlyPrice.amount
        : 500 * 12 // fallback
    const subscribersNeeded = Math.ceil(1000000 / annualRevenue)

    // Count current subscribers on this plan
    const currentSubscribers = (subscriptions || []).filter((s: any) => {
      const subPrice = (prices || []).find((p: any) => p.id === s.price_id)
      return subPrice?.plan_id === plan.id && s.status === 'active'
    }).length

    return {
      planId: plan.id,
      planName: plan.name,
      description: plan.description,
      monthlyPrice: monthlyPrice?.amount || null,
      yearlyPrice: yearlyPrice?.amount || null,
      currency: monthlyPrice?.currency || yearlyPrice?.currency || 'USD',
      subscribersNeeded,
      currentSubscribers,
      progress: (currentSubscribers / subscribersNeeded) * 100,
    }
  })

  // Calculate overall subscribers to target
  const lowestAnnualPrice = pricingTiers.length > 0
    ? Math.min(...pricingTiers.map((t: any) => t.monthlyPrice ? t.monthlyPrice * 12 : t.yearlyPrice || 999999))
    : (paidCustomers > 0 ? (mrr * 12) / paidCustomers : 500 * 12)

  const subscribersToTarget = {
    current: subscriptionCounts.active || paidCustomers,
    needed: Math.ceil(1000000 / lowestAnnualPrice),
    avgRevenuePerUser: lowestAnnualPrice,
  }

  const metrics = {
    totalRevenue,
    mrr,
    arr: mrr * 12,
    totalSignups,
    paidCustomers,
    activeCustomers,
    churnedCustomers,
    conversionRate: totalSignups > 0 ? (paidCustomers / totalSignups) * 100 : 0,
  }

  // Check if Stripe is configured
  const stripeConfigured = !!venture.stripe_secret_key

  return (
    <VentureDetailClient
      venture={{
        id: venture.id,
        name: venture.name,
        slug: venture.slug,
        tagline: venture.tagline,
        url: venture.url,
        github_url: venture.github_url,
        status: venture.status,
        target_arr: venture.target_arr,
        stripe_configured: stripeConfigured,
      }}
      signups={signupsList.map((s: any) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        plan: s.plan,
        status: s.status,
        source: s.source,
        created_at: s.created_at,
      }))}
      events={(events || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        email: e.email,
        created_at: e.created_at,
      }))}
      metrics={metrics}
      planDistribution={planDistribution}
      monthlyRevenue={monthlyRevenue}
      pricingTiers={pricingTiers}
      subscribersToTarget={subscribersToTarget}
      subscriptionCounts={subscriptionCounts}
    />
  )
}