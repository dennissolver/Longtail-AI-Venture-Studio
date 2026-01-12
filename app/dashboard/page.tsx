// app/dashboard/page.tsx
import { createSupabaseServer } from '@/lib/supabase-server'
import DashboardClient from '@/components/DashboardClient'
import { fetchVentureStripeData } from '@/lib/stripe-data'

export const dynamic = 'force-dynamic'

const TARGET_ARR = 1_000_000

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()

  // Get ventures
  const { data: ventures } = await supabase
    .from('ventures')
    .select('*')
    .order('created_at', { ascending: false })

  if (!ventures || ventures.length === 0) {
    return (
      <DashboardClient
        ventures={[]}
        totals={{
          totalRevenue: 0,
          mrr: 0,
          arr: 0,
          totalSignups: 0,
          paidCustomers: 0,
          trialingCustomers: 0
        }}
      />
    )
  }

  // Get aggregated stats for each venture WITH Stripe status
  const ventureStats = await Promise.all(
    ventures.map(async (venture) => {
      // Fetch Stripe data with status check
      const stripeResult = await fetchVentureStripeData(
        venture.stripe_secret_key,
        venture.stripe_webhook_secret
      )

      const stripeStatus = stripeResult.status.status
      const stripeData = stripeResult.data

      // Get signups from tracking table (works regardless of Stripe)
      const { data: signups } = await supabase
        .from('signups')
        .select('plan, status')
        .eq('venture_id', venture.id)

      const totalSignups = (signups || []).length

      // Calculate subscribers needed based on Stripe pricing
      let subscribersNeeded = 0
      if (stripeData?.avgPlanPrice && stripeData.avgPlanPrice > 0) {
        subscribersNeeded = Math.ceil(TARGET_ARR / 12 / stripeData.avgPlanPrice)
      }

      return {
        id: venture.id,
        name: venture.name,
        slug: venture.slug,
        tagline: venture.tagline,
        url: venture.url,
        status: venture.status || 'active',
        target_arr: venture.target_arr || TARGET_ARR,

        // Revenue from Stripe (if connected)
        total_revenue: stripeData?.totalRevenue || 0,
        mrr: stripeData?.mrr || 0,
        arr: (stripeData?.mrr || 0) * 12,

        // Signup/customer data
        total_signups: totalSignups,
        paid_customers: stripeData?.activeSubscriptions || 0,
        trialing_customers: 0,

        // NEW: Stripe status for error display
        stripe_status: stripeStatus,
        stripe_message: stripeResult.status.message,

        // Stripe-derived metrics
        subscribers_needed: subscribersNeeded,
        avg_revenue_per_user: stripeData?.avgPlanPrice || 0,
        lowest_monthly_price: stripeData?.plans?.[0]?.price || null,
        has_stripe_pricing: (stripeData?.plans?.length || 0) > 0
      }
    })
  )

  // Calculate totals (only from Stripe-connected ventures)
  const connectedVentures = ventureStats.filter(v => v.stripe_status === 'ready')

  const totals = {
    totalRevenue: connectedVentures.reduce((sum, v) => sum + v.total_revenue, 0),
    mrr: connectedVentures.reduce((sum, v) => sum + v.mrr, 0),
    arr: connectedVentures.reduce((sum, v) => sum + v.arr, 0),
    totalSignups: ventureStats.reduce((sum, v) => sum + v.total_signups, 0),
    paidCustomers: connectedVentures.reduce((sum, v) => sum + v.paid_customers, 0),
    trialingCustomers: 0
  }

  return <DashboardClient ventures={ventureStats} totals={totals} />
}