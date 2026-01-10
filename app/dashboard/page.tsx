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
      const { data: revenue } = await supabase
        .from('revenue')
        .select('amount, type')
        .eq('venture_id', venture.id)

      const { data: signups } = await supabase
        .from('signups')
        .select('plan, status')
        .eq('venture_id', venture.id)

      const totalRevenue = (revenue || [])
        .filter((r: any) => r.type !== 'refund')
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

      const mrr = (revenue || [])
        .filter((r: any) => r.type === 'subscription')
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

      const totalSignups = (signups || []).length
      const paidCustomers = (signups || []).filter((s: any) => s.plan !== 'free').length

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

  const totalRevenue = (allRevenue || [])
    .filter((r: any) => r.type !== 'refund')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  const mrr = (allRevenue || [])
    .filter((r: any) => r.type === 'subscription')
    .reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  const totals = {
    totalRevenue,
    mrr,
    arr: mrr * 12,
    totalSignups: (allSignups || []).length,
    paidCustomers: (allSignups || []).filter((s: any) => s.plan !== 'free').length,
  }

  return <DashboardClient ventures={ventureStats} totals={totals} />
}