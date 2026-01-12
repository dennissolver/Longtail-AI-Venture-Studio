'use client'

import { formatCurrency, formatNumber } from '@/lib/utils'
import AddVentureButton from '@/components/AddVentureButton'
import { Card, Metric, Text, Flex, Grid, Title, Badge, ProgressBar } from '@tremor/react'
import {
  ExclamationTriangleIcon,
  KeyIcon,
  CubeIcon,
  CheckCircleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Target } from 'lucide-react'

type VentureStripeStatus =
  | 'ready'
  | 'needs_stripe_key'
  | 'needs_webhook_secret'
  | 'needs_env_vars'
  | 'no_products'
  | 'no_data'
  | 'error'

interface VentureWithStatus {
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
  stripe_status: VentureStripeStatus
  stripe_message?: string
  trialing_customers?: number
  subscribers_needed?: number
  avg_revenue_per_user?: number
  lowest_monthly_price?: number | null
  has_stripe_pricing?: boolean
}

interface DashboardClientProps {
  ventures: VentureWithStatus[]
  totals: {
    totalRevenue: number
    mrr: number
    arr: number
    totalSignups: number
    paidCustomers: number
    trialingCustomers?: number
  }
}

const statusConfig: Record<VentureStripeStatus, {
  color: 'emerald' | 'amber' | 'red' | 'blue' | 'gray'
  icon: React.ElementType
  label: string
}> = {
  ready: { color: 'emerald', icon: CheckCircleIcon, label: 'Connected' },
  needs_stripe_key: { color: 'amber', icon: KeyIcon, label: 'Needs Stripe Key' },
  needs_webhook_secret: { color: 'amber', icon: KeyIcon, label: 'Needs Webhook' },
  needs_env_vars: { color: 'amber', icon: KeyIcon, label: 'Needs Env Vars' },
  no_products: { color: 'blue', icon: CubeIcon, label: 'No Products' },
  no_data: { color: 'gray', icon: CubeIcon, label: 'No Data Yet' },
  error: { color: 'red', icon: ExclamationTriangleIcon, label: 'Error' }
}

function VentureCard({ venture }: { venture: VentureWithStatus }) {
  const isReady = venture.stripe_status === 'ready'
  const config = statusConfig[venture.stripe_status]
  const StatusIcon = config.icon
  const progressPercent = Math.min((venture.arr / venture.target_arr) * 100, 100)

  return (
    <Card className="relative">
      <Flex justifyContent="between" alignItems="start">
        <div>
          <Link href={`/dashboard/${venture.slug}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
            {venture.name}
          </Link>
          {venture.tagline && <Text className="text-gray-500 text-sm mt-0.5">{venture.tagline}</Text>}
        </div>
        <Badge color={config.color} size="sm" icon={StatusIcon}>{config.label}</Badge>
      </Flex>

      {isReady ? (
        <div className="mt-4 space-y-4">
          <Flex justifyContent="between">
            <div>
              <Text className="text-gray-500 text-xs">MRR</Text>
              <Text className="text-xl font-semibold text-emerald-600">{formatCurrency(venture.mrr)}</Text>
            </div>
            <div className="text-right">
              <Text className="text-gray-500 text-xs">ARR</Text>
              <Text className="text-xl font-semibold">{formatCurrency(venture.arr)}</Text>
            </div>
          </Flex>
          <div>
            <Flex justifyContent="between" className="mb-1">
              <Text className="text-xs text-gray-500">Progress to $1M ARR</Text>
              <Text className="text-xs text-gray-600">{progressPercent.toFixed(1)}%</Text>
            </Flex>
            <ProgressBar value={progressPercent} color="blue" />
          </div>
          <Flex justifyContent="between" className="text-sm">
            <div>
              <Text className="text-gray-500">Subscribers</Text>
              <Badge color="emerald" size="sm">{venture.paid_customers} paid</Badge>
            </div>
            {venture.subscribers_needed && (
              <div className="text-right">
                <Text className="text-gray-500">Need</Text>
                <Text className="font-medium text-blue-600">
                  {venture.subscribers_needed - venture.paid_customers > 0
                    ? `${(venture.subscribers_needed - venture.paid_customers).toLocaleString()} more`
                    : '✓ Target met!'}
                </Text>
              </div>
            )}
          </Flex>
        </div>
      ) : (
        <div className="mt-4">
          <div className={`rounded-lg p-4 ${venture.stripe_status === 'error' ? 'bg-red-50' : 'bg-amber-50'}`}>
            <Flex className="gap-3" alignItems="start">
              <StatusIcon className={`h-5 w-5 flex-shrink-0 ${venture.stripe_status === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <Text className={`font-medium ${venture.stripe_status === 'error' ? 'text-red-800' : 'text-amber-800'}`}>
                  {config.label}
                </Text>
                <Text className={`text-sm mt-1 ${venture.stripe_status === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {venture.stripe_status === 'needs_stripe_key' && 'Add Stripe secret key to see revenue'}
                  {venture.stripe_status === 'needs_webhook_secret' && 'Add webhook secret for real-time sync'}
                  {venture.stripe_status === 'no_products' && 'Create products in Stripe dashboard'}
                  {venture.stripe_status === 'no_data' && 'Waiting for first subscription'}
                  {venture.stripe_status === 'error' && 'Check API key or Stripe account'}
                </Text>
              </div>
            </Flex>
            <Link href={`/dashboard/${venture.slug}/settings`}>
              <button className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                venture.stripe_status === 'error' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}>
                <Cog6ToothIcon className="h-4 w-4" />
                Configure Stripe
              </button>
            </Link>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t">
        <Link href={`/dashboard/${venture.slug}`} className="text-sm text-blue-600 hover:text-blue-800">
          View Details →
        </Link>
      </div>
    </Card>
  )
}

export default function DashboardClient({ ventures, totals }: DashboardClientProps) {
  const venturesReady = ventures.filter(v => v.stripe_status === 'ready').length
  const venturesNeedSetup = ventures.filter(v => v.stripe_status === 'needs_stripe_key' || v.stripe_status === 'needs_webhook_secret').length
  const totalTargetArr = ventures.reduce((sum, v) => sum + v.target_arr, 0)
  const portfolioProgress = totalTargetArr > 0 ? (totals.arr / totalTargetArr) * 100 : 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Centre</h1>
          <p className="text-gray-500 mt-1">Building AI-native businesses to $1M ARR</p>
        </div>
        <AddVentureButton />
      </div>

      {venturesNeedSetup > 0 && (
        <Card className="bg-amber-50 border border-amber-200">
          <Flex alignItems="center" className="gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
            <div>
              <Text className="font-medium text-amber-800">
                {venturesNeedSetup} venture{venturesNeedSetup > 1 ? 's need' : ' needs'} Stripe configuration
              </Text>
              <Text className="text-amber-600 text-sm">Configure Stripe keys to see live revenue data</Text>
            </div>
          </Flex>
        </Card>
      )}

      <Grid numItems={1} numItemsSm={2} numItemsLg={5} className="gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Total Revenue</Text>
          <Metric>{formatCurrency(totals.totalRevenue)}</Metric>
          <Text className="text-xs text-gray-500 mt-1">From {venturesReady} connected ventures</Text>
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
            <Text>Total Signups</Text>
            <Badge color="emerald">{totals.paidCustomers} paid</Badge>
          </Flex>
          <Metric>{formatNumber(totals.totalSignups)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Stripe Status</Text>
          <Flex className="mt-2 gap-2">
            <Badge color="emerald">{venturesReady} connected</Badge>
            {venturesNeedSetup > 0 && <Badge color="amber">{venturesNeedSetup} pending</Badge>}
          </Flex>
        </Card>
      </Grid>

      <Card decoration="left" decorationColor="indigo">
        <Flex justifyContent="start" alignItems="center" className="gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-500" />
          <Title>Portfolio Path to ${formatNumber(totalTargetArr / 1000000)}M ARR</Title>
        </Flex>
        <Flex justifyContent="between" className="mb-1">
          <Text className="text-sm">Portfolio Progress</Text>
          <Text className="text-sm font-medium">{portfolioProgress.toFixed(1)}%</Text>
        </Flex>
        <ProgressBar value={portfolioProgress} color="indigo" className="h-2" />
      </Card>

      <div>
        <Flex justifyContent="between" alignItems="center" className="mb-4">
          <Title>Ventures ({ventures.length})</Title>
          <Flex className="gap-2">
            <Badge color="emerald">{venturesReady} live</Badge>
            <Badge color="amber">{venturesNeedSetup} setup needed</Badge>
          </Flex>
        </Flex>

        <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
          {ventures.map((venture) => (
            <VentureCard key={venture.id} venture={venture} />
          ))}
          <Card className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]">
            <AddVentureButton variant="ghost" />
          </Card>
        </Grid>
      </div>
    </div>
  )
}