import { createSupabaseServer } from '@/lib/supabase-server'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()

  // Get ventures
  const { data: ventures } = await supabase
    .from('ventures')
    .select('*')
    .order('created_at', { ascending: false })

  // Get aggregated stats for each venture
  const ventureStats = await Promise.all(
    (ventures || []).map(async (venture) => {
      // Get revenue
      const { data: revenue } = await supabase
        .from('revenue')
        .select('amount, type')
        .eq('venture_id', venture.id)

      // Get signups
      const { data: signups } = await supabase
        .from('signups')
        .select('plan, status')
        .eq('venture_id', venture.id)

      // Get active subscriptions from Stripe data
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('id, status, price_id')
        .eq('venture_id', venture.id)
        .eq('status', 'active')

      // Get prices for this venture (for calculating subscriber targets)
      const { data: prices } = await supabase
        .from('prices')
        .select('id, amount, interval, is_active')
        .eq('venture_id', venture.id)
        .eq('is_active', true)

      // Get trialing subscriptions count
      const { count: trialingCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('venture_id', venture.id)
        .eq('status', 'trialing')

      const totalRevenue = (revenue || [])
        .filter((r: any) => r.type !== 'refund')
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

      // Calculate MRR from active subscriptions if available
      let mrr = 0
      const activeSubscriptions = subscriptions || []
      
      if (activeSubscriptions.length > 0 && prices && prices.length > 0) {
        // Calculate MRR from actual subscription data
        mrr = activeSubscriptions.reduce((sum, sub) => {
          const price = prices.find(p => p.id === sub.price_id)
          if (!price) return sum
          if (price.interval === 'month') {
            return sum + Number(price.amount)
          } else if (price.interval === 'year') {
            return sum + (Number(price.amount) / 12)
          }
          return sum
        }, 0)
      } else {
        // Fallback to revenue-based MRR
        mrr = (revenue || [])
          .filter((r: any) => r.type === 'subscription')
          .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      }

      const totalSignups = (signups || []).length
      
      // Use Stripe subscription count if available, otherwise fall back to signups
      const paidCustomers = activeSubscriptions.length > 0 
        ? activeSubscriptions.length
        : (signups || []).filter((s: any) => s.plan !== 'free').length

      // Calculate subscribers needed based on lowest monthly price
      const monthlyPrices = (prices || [])
        .filter(p => p.interval === 'month')
        .map(p => Number(p.amount))
      
      const lowestMonthlyPrice = monthlyPrices.length > 0 
        ? Math.min(...monthlyPrices) 
        : null

      // Calculate subscribers needed for $1M ARR
      let subscribersNeeded = 0
      let avgRevenuePerUser = 0
      
      if (lowestMonthlyPrice && lowestMonthlyPrice > 0) {
        // Use actual Stripe pricing
        avgRevenuePerUser = lowestMonthlyPrice * 12
        subscribersNeeded = Math.ceil(venture.target_arr / avgRevenuePerUser)
      } else if (paidCustomers > 0 && mrr > 0) {
        // Estimate from current customers
        avgRevenuePerUser = (mrr * 12) / paidCustomers
        subscribersNeeded = Math.ceil(venture.target_arr / avgRevenuePerUser)
      } else {
        // Default fallback
        avgRevenuePerUser = 500 * 12
        subscribersNeeded = Math.ceil(venture.target_arr / avgRevenuePerUser)
      }

      return {
        id: venture.id,
        name: venture.name,
        slug: venture.slug,
        tagline: venture.tagline,
        url: venture.url,
        status: venture.status,
        target_arr: venture.target_arr,
        total_revenue: totalRevenue,
        mrr,
        arr: mrr * 12,
        total_signups: totalSignups,
        paid_customers: paidCustomers,
        // Stripe-derived data
        stripe_configured: !!venture.stripe_secret_key,
        trialing_customers: trialingCount || 0,
        subscribers_needed: subscribersNeeded,
        avg_revenue_per_user: avgRevenuePerUser,
        lowest_monthly_price: lowestMonthlyPrice,
        has_stripe_pricing: lowestMonthlyPrice !== null,
      }
    })
  )

  // Get portfolio totals
  const { data: allRevenue } = await supabase
    .from('revenue')
    .select('amount, type')

  const { data: allSignups } = await supabase
    .from('signups')
    .select('plan')

  // Get all active subscriptions across portfolio
  const { count: totalActiveSubscriptions } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: totalTrialingSubscriptions } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'trialing')

  const totalRevenue = (allRevenue || [])
    .filter((r: any) => r.type !== 'refund')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  // Calculate portfolio MRR from venture stats (already includes Stripe data)
  const portfolioMrr = ventureStats.reduce((sum, v) => sum + v.mrr, 0)

  // Use Stripe subscription counts if available
  const paidFromStripe = totalActiveSubscriptions || 0
  const paidFromSignups = (allSignups || []).filter((s: any) => s.plan !== 'free').length
  const paidCustomers = paidFromStripe > 0 ? paidFromStripe : paidFromSignups

  const totals = {
    totalRevenue,
    mrr: portfolioMrr,
    arr: portfolioMrr * 12,
    totalSignups: (allSignups || []).length,
    paidCustomers,
    trialingCustomers: totalTrialingSubscriptions || 0,
  }

  return <DashboardClient ventures={ventureStats} totals={totals} />
}
