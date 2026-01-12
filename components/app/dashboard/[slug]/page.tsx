import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import VentureDetailClient from '@/components/VentureDetailClient'
import StripeConfig from '@/components/StripeConfig'

export const dynamic = 'force-dynamic'

export default async function VentureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createSupabaseServer()

  // Get venture
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

  // Get Stripe plans and prices
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, description, stripe_product_id, is_active')
    .eq('venture_id', venture.id)
    .eq('is_active', true)

  const { data: prices } = await supabase
    .from('prices')
    .select('id, plan_id, amount, currency, interval, interval_count, is_active')
    .eq('venture_id', venture.id)
    .eq('is_active', true)

  // Get subscriptions from Stripe data
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, price_id, stripe_subscription_id')
    .eq('venture_id', venture.id)

  // Count subscriptions by status
  const subscriptionCounts = {
    active: (subscriptions || []).filter(s => s.status === 'active').length,
    trialing: (subscriptions || []).filter(s => s.status === 'trialing').length,
    canceled: (subscriptions || []).filter(s => s.status === 'canceled').length,
    pastDue: (subscriptions || []).filter(s => s.status === 'past_due').length,
  }

  // Build pricing tiers with subscriber calculations
  const pricingTiers = (plans || []).map(plan => {
    const planPrices = (prices || []).filter(p => p.plan_id === plan.id)
    const monthlyPrice = planPrices.find(p => p.interval === 'month')
    const yearlyPrice = planPrices.find(p => p.interval === 'year')
    
    // Calculate monthly equivalent for ARR calculation
    let monthlyAmount = 0
    if (monthlyPrice) {
      monthlyAmount = Number(monthlyPrice.amount)
    } else if (yearlyPrice) {
      monthlyAmount = Number(yearlyPrice.amount) / 12
    }
    
    const yearlyAmount = monthlyAmount * 12
    const subscribersNeeded = yearlyAmount > 0 ? Math.ceil(1000000 / yearlyAmount) : 0
    
    // Count active subscribers on this plan
    const planPriceIds = planPrices.map(p => p.id)
    const activeOnPlan = (subscriptions || []).filter(
      s => s.status === 'active' && planPriceIds.includes(s.price_id)
    ).length

    return {
      planId: plan.id,
      planName: plan.name,
      description: plan.description,
      monthlyPrice: monthlyPrice ? Number(monthlyPrice.amount) : null,
      yearlyPrice: yearlyPrice ? Number(yearlyPrice.amount) : null,
      currency: monthlyPrice?.currency || yearlyPrice?.currency || 'USD',
      subscribersNeeded,
      currentSubscribers: activeOnPlan,
      progress: subscribersNeeded > 0 ? (activeOnPlan / subscribersNeeded) * 100 : 0,
    }
  })

  // Calculate overall subscriber target (using lowest priced plan)
  const lowestMonthlyPrice = (prices || [])
    .filter(p => p.interval === 'month' && p.is_active)
    .reduce((min, p) => Math.min(min, Number(p.amount)), Infinity)
  
  const hasStripePricing = lowestMonthlyPrice !== Infinity && lowestMonthlyPrice > 0

  // Calculate metrics
  const totalRevenue = (revenue || [])
    .filter((r: any) => r.type !== 'refund')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  // MRR from active subscriptions (real data)
  let mrr = 0
  if (subscriptions && prices) {
    mrr = (subscriptions || [])
      .filter(s => s.status === 'active')
      .reduce((sum, sub) => {
        const price = prices.find(p => p.id === sub.price_id)
        if (!price) return sum
        if (price.interval === 'month') {
          return sum + Number(price.amount)
        } else if (price.interval === 'year') {
          return sum + (Number(price.amount) / 12)
        }
        return sum
      }, 0)
  }
  
  // Fallback to revenue-based MRR if no subscription data
  if (mrr === 0) {
    mrr = (revenue || [])
      .filter((r: any) => r.type === 'subscription')
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
  }

  const signupsList = signups || []
  const totalSignups = signupsList.length
  const paidCustomers = subscriptionCounts.active > 0 
    ? subscriptionCounts.active 
    : signupsList.filter((s: any) => s.plan !== 'free').length
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

  // Build subscriber target data from Stripe pricing
  const subscribersToTarget = hasStripePricing ? {
    current: subscriptionCounts.active,
    needed: Math.ceil(1000000 / (lowestMonthlyPrice * 12)),
    avgRevenuePerUser: lowestMonthlyPrice * 12,
    lowestMonthlyPrice,
    pricingSource: 'stripe' as const,
  } : {
    current: paidCustomers,
    needed: paidCustomers > 0 
      ? Math.ceil(1000000 / (metrics.arr / paidCustomers))
      : Math.ceil(1000000 / (500 * 12)),
    avgRevenuePerUser: paidCustomers > 0 ? metrics.arr / paidCustomers : 500 * 12,
    lowestMonthlyPrice: null,
    pricingSource: 'estimated' as const,
  }

  // Get Stripe sync status for StripeConfig component
  const { count: plansCount } = await supabase
    .from('plans')
    .select('*', { count: 'exact', head: true })
    .eq('venture_id', venture.id)

  const { count: pricesCount } = await supabase
    .from('prices')
    .select('*', { count: 'exact', head: true })
    .eq('venture_id', venture.id)

  return (
    <div className="space-y-8">
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
          stripe_configured: !!venture.stripe_secret_key,
        } as any}
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
      
      {/* Stripe Configuration Section */}
      <StripeConfig
        ventureSlug={venture.slug}
        isConfigured={!!venture.stripe_secret_key}
        plansCount={plansCount || 0}
        pricesCount={pricesCount || 0}
        activeSubscriptions={subscriptionCounts.active}
      />
    </div>
  )
}
