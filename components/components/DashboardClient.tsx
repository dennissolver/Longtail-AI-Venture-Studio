'use client'

import { formatCurrency, formatNumber } from '@/lib/utils'
import VentureCard from '@/components/VentureCard'
import AddVentureButton from '@/components/AddVentureButton'
import { Card, Metric, Text, Flex, Grid, Title, Badge, ProgressBar } from '@tremor/react'
import { Target, CreditCard, Users } from 'lucide-react'

interface VentureWithStripeData {
  id: string
  name: string
  slug: string
  tagline: string | null
  url: string | null
  status: string
  target_arr: number
  total_revenue: number
  mrr: number
  arr: number
  total_signups: number
  paid_customers: number
  stripe_configured?: boolean
  trialing_customers?: number
  subscribers_needed?: number
  avg_revenue_per_user?: number
  lowest_monthly_price?: number | null
  has_stripe_pricing?: boolean
}

interface DashboardClientProps {
  ventures: VentureWithStripeData[]
  totals: {
    totalRevenue: number
    mrr: number
    arr: number
    totalSignups: number
    paidCustomers: number
    trialingCustomers?: number
  }
}

export default function DashboardClient({ ventures, totals }: DashboardClientProps) {
  // Calculate portfolio-wide metrics
  const totalTargetArr = ventures.reduce((sum, v) => sum + v.target_arr, 0)
  const portfolioProgress = totalTargetArr > 0 ? (totals.arr / totalTargetArr) * 100 : 0

  // Calculate total subscribers needed across all ventures (now from real pricing data)
  const totalSubscribersNeeded = ventures.reduce((sum, v) => {
    return sum + (v.subscribers_needed || Math.ceil(v.target_arr / (500 * 12)))
  }, 0)

  // Count ventures with Stripe configured
  const venturesWithStripe = ventures.filter(v => v.stripe_configured).length

  // Calculate average revenue per paying customer
  const avgRevenuePerUser = totals.paidCustomers > 0
    ? totals.arr / totals.paidCustomers
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Centre</h1>
          <p className="text-gray-500 mt-1">Building AI-native businesses to $1M ARR</p>
        </div>
        <AddVentureButton />
      </div>

      {/* Portfolio Overview Cards */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor="blue">
          <Text>Total Revenue</Text>
          <Metric>{formatCurrency(totals.totalRevenue)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>MRR</Text>
          <Metric>{formatCurrency(totals.mrr)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>ARR</Text>
          <Metric>{formatCurrency(totals.arr)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="violet">
          <Flex justifyContent="between" alignItems="center">
            <Text>Subscribers</Text>
            <div className="flex gap-1">
              <Badge color="emerald">{totals.paidCustomers} paid</Badge>
              {totals.trialingCustomers ? (
                <Badge color="blue">{totals.trialingCustomers} trial</Badge>
              ) : null}
            </div>
          </Flex>
          <Metric>{formatNumber(totals.totalSignups)}</Metric>
          <Text className="text-xs text-gray-500">total signups</Text>
        </Card>
      </Grid>

      {/* Portfolio Progress to Target */}
      <Card decoration="left" decorationColor="indigo">
        <Flex justifyContent="start" alignItems="center" className="gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-500" />
          <Title>Portfolio Path to ${formatNumber(totalTargetArr / 1000000)}M ARR</Title>
          {venturesWithStripe > 0 && (
            <Badge color="emerald" size="sm">
              <CreditCard className="w-3 h-3 mr-1" />
              {venturesWithStripe} Stripe Connected
            </Badge>
          )}
        </Flex>
        <Grid numItems={1} numItemsSm={4} className="gap-4 mb-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Current ARR</Text>
            <Metric className="text-lg text-indigo-600">{formatCurrency(totals.arr)}</Metric>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Target ARR</Text>
            <Metric className="text-lg text-gray-600">{formatCurrency(totalTargetArr)}</Metric>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Paid Subscribers</Text>
            <Metric className="text-lg text-emerald-600">{totals.paidCustomers}</Metric>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Avg Rev/User</Text>
            <Metric className="text-lg text-amber-600">{formatCurrency(avgRevenuePerUser)}/yr</Metric>
          </div>
        </Grid>
        <Flex justifyContent="between" className="mb-1">
          <Text className="text-sm">Portfolio Progress</Text>
          <Text className="text-sm font-medium">{portfolioProgress.toFixed(1)}%</Text>
        </Flex>
        <ProgressBar value={portfolioProgress} color="indigo" className="h-2" />
      </Card>

      {/* Portfolio Subscriber Summary */}
      <Card>
        <Flex justifyContent="start" alignItems="center" className="gap-2 mb-4">
          <Users className="w-5 h-5 text-violet-500" />
          <Title>Subscribers Needed by Venture</Title>
        </Flex>
        <div className="space-y-3">
          {ventures.map((venture) => {
            const needed = venture.subscribers_needed || Math.ceil(venture.target_arr / (500 * 12))
            const progress = needed > 0 ? (venture.paid_customers / needed) * 100 : 0
            
            return (
              <div key={venture.id} className="p-3 bg-gray-50 rounded-lg">
                <Flex justifyContent="between" alignItems="center" className="mb-2">
                  <div className="flex items-center gap-2">
                    <Text className="font-medium">{venture.name}</Text>
                    {venture.has_stripe_pricing ? (
                      <Badge color="emerald" size="xs">
                        {formatCurrency(venture.lowest_monthly_price || 0)}/mo
                      </Badge>
                    ) : venture.stripe_configured ? (
                      <Badge color="amber" size="xs">Sync Needed</Badge>
                    ) : (
                      <Badge color="gray" size="xs">Estimated</Badge>
                    )}
                  </div>
                  <Text className="text-sm">
                    <span className="font-semibold text-indigo-600">{venture.paid_customers}</span>
                    <span className="text-gray-400"> / </span>
                    <span className="font-semibold text-amber-600">{formatNumber(needed)}</span>
                    <span className="text-gray-400"> subscribers</span>
                  </Text>
                </Flex>
                <ProgressBar value={Math.min(progress, 100)} color="violet" className="h-1.5" />
              </div>
            )
          })}
        </div>
      </Card>

      {/* Active Ventures */}
      <div>
        <Title className="mb-4">Ventures ({ventures.length})</Title>

        {ventures.length === 0 ? (
          <Card className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <Text className="text-gray-500 mb-4">No ventures yet</Text>
            <AddVentureButton />
          </Card>
        ) : (
          <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
            {ventures.map((venture) => (
              <VentureCard key={venture.id} venture={venture} />
            ))}

            {/* Add New Venture Card */}
            <Card className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]">
              <AddVentureButton variant="ghost" />
            </Card>
          </Grid>
        )}
      </div>
    </div>
  )
}
