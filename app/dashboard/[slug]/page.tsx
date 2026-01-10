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
    />
  )
}