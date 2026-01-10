'use client'

import Link from 'next/link'
import { formatCurrency, formatNumber, calculateProgress, timeAgo, getStatusColor, getPlanColor } from '@/lib/utils'
import {
  Card,
  Metric,
  Text,
  Flex,
  ProgressBar,
  Grid,
  Title,
  Badge,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  AreaChart,
  BarChart,
  DonutChart,
} from '@tremor/react'
import { ArrowLeft, ExternalLink, Github, TrendingUp, Users, DollarSign, Activity, Target, UserMinus, Calendar } from 'lucide-react'

interface VentureDetailProps {
  venture: {
    id: string
    name: string
    slug: string
    tagline: string | null
    url: string | null
    github_url: string | null
    status: string
    target_arr: number
  }
  signups: Array<{
    id: string
    email: string
    name: string | null
    plan: string
    status: string
    source: string | null
    created_at: string
  }>
  events: Array<{
    id: string
    type: string
    email: string | null
    created_at: string
  }>
  metrics: {
    totalRevenue: number
    mrr: number
    arr: number
    totalSignups: number
    paidCustomers: number
    activeCustomers: number
    churnedCustomers: number
    conversionRate: number
  }
  planDistribution: Array<{ name: string; value: number }>
  monthlyRevenue: Array<{ month: string; Revenue: number }>
  // New analytics props
  dailySignups?: Array<{ date: string; signups: number }>
  churnData?: {
    rate: number
    monthly: Array<{ month: string; churned: number; retained: number }>
  }
  subscribersToTarget?: {
    current: number
    needed: number
    avgRevenuePerUser: number
  }
}

export default function VentureDetailClient({
  venture,
  signups,
  events,
  metrics,
  planDistribution,
  monthlyRevenue,
  dailySignups = [],
  churnData,
  subscribersToTarget,
}: VentureDetailProps) {
  const progress = calculateProgress(metrics.arr, venture.target_arr)

  // Calculate subscribers needed to reach $1M ARR
  const avgRevenuePerUser = metrics.paidCustomers > 0
    ? metrics.arr / metrics.paidCustomers
    : 500 * 12 // Default assumption: $500/month average
  const subscribersNeeded = Math.ceil(1000000 / avgRevenuePerUser)
  const subscribersRemaining = Math.max(0, subscribersNeeded - metrics.paidCustomers)

  // Calculate churn rate
  const churnRate = metrics.totalSignups > 0
    ? (metrics.churnedCustomers / metrics.totalSignups) * 100
    : 0

  // Generate daily signups for last 30 days if not provided
  const last30DaysSignups = dailySignups.length > 0 ? dailySignups : generateDailySignups(signups)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Flex justifyContent="start" alignItems="center" className="gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{venture.name}</h1>
            <Badge color={getStatusColor(venture.status) as any} size="lg">
              {venture.status}
            </Badge>
          </Flex>
          {venture.tagline && (
            <p className="text-gray-500 mt-1">{venture.tagline}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {venture.github_url && (
            <a
              href={venture.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          )}
          {venture.url && (
            <a
              href={venture.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Site
            </a>
          )}
        </div>
      </div>

      {/* ARR Progress */}
      <Card>
        <Flex justifyContent="between" alignItems="center" className="mb-2">
          <Title>Progress to $1M ARR</Title>
          <Text className="font-semibold">{progress.toFixed(1)}%</Text>
        </Flex>
        <ProgressBar value={progress} color="blue" className="h-3" />
        <Flex justifyContent="between" className="mt-2">
          <Text>Current ARR: {formatCurrency(metrics.arr)}</Text>
          <Text>Target: {formatCurrency(venture.target_arr)}</Text>
        </Flex>
      </Card>

      {/* Target Analysis - Subscribers Needed */}
      <Card decoration="left" decorationColor="indigo">
        <Flex justifyContent="start" alignItems="center" className="gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-500" />
          <Title>Path to $1M ARR</Title>
        </Flex>
        <Grid numItems={1} numItemsSm={3} className="gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Current Paid Subscribers</Text>
            <Metric className="text-indigo-600">{metrics.paidCustomers}</Metric>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Subscribers Needed</Text>
            <Metric className="text-amber-600">{formatNumber(subscribersNeeded)}</Metric>
            <Text className="text-xs text-gray-400">at {formatCurrency(avgRevenuePerUser)}/yr avg</Text>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-500">Still Need</Text>
            <Metric className="text-rose-600">{formatNumber(subscribersRemaining)}</Metric>
            <Text className="text-xs text-gray-400">more subscribers</Text>
          </div>
        </Grid>
        <div className="mt-4">
          <Flex justifyContent="between" className="mb-1">
            <Text className="text-sm">Subscriber Progress</Text>
            <Text className="text-sm font-medium">
              {metrics.paidCustomers} / {subscribersNeeded}
            </Text>
          </Flex>
          <ProgressBar
            value={(metrics.paidCustomers / subscribersNeeded) * 100}
            color="indigo"
            className="h-2"
          />
        </div>
      </Card>

      {/* Key Metrics */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={5} className="gap-6">
        <Card decoration="top" decorationColor="emerald">
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <Text>Total Revenue</Text>
          </Flex>
          <Metric>{formatCurrency(metrics.totalRevenue)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <Text>MRR</Text>
          </Flex>
          <Metric>{formatCurrency(metrics.mrr)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <Text>Total Signups</Text>
          </Flex>
          <Metric>{formatNumber(metrics.totalSignups)}</Metric>
          <Text className="text-sm text-gray-500">
            {metrics.paidCustomers} paid ({metrics.conversionRate.toFixed(1)}% conversion)
          </Text>
        </Card>
        <Card decoration="top" decorationColor="violet">
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <Activity className="w-5 h-5 text-violet-500" />
            <Text>Active Customers</Text>
          </Flex>
          <Metric>{formatNumber(metrics.activeCustomers)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <UserMinus className="w-5 h-5 text-rose-500" />
            <Text>Churn Rate</Text>
          </Flex>
          <Metric className={churnRate > 10 ? 'text-rose-600' : churnRate > 5 ? 'text-amber-600' : 'text-emerald-600'}>
            {churnRate.toFixed(1)}%
          </Metric>
          <Text className="text-sm text-gray-500">
            {metrics.churnedCustomers} churned
          </Text>
        </Card>
      </Grid>

      {/* Daily Signups Chart */}
      <Card>
        <Flex justifyContent="start" alignItems="center" className="gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <Title>Daily Signups (Last 30 Days)</Title>
        </Flex>
        <BarChart
          className="h-48"
          data={last30DaysSignups}
          index="date"
          categories={['signups']}
          colors={['blue']}
          valueFormatter={(value) => formatNumber(value)}
          showLegend={false}
        />
      </Card>

      {/* Charts Row */}
      <Grid numItems={1} numItemsLg={2} className="gap-6">
        {/* Revenue Chart */}
        <Card>
          <Title>Revenue (Last 6 Months)</Title>
          <AreaChart
            className="mt-4 h-48"
            data={monthlyRevenue}
            index="month"
            categories={['Revenue']}
            colors={['blue']}
            valueFormatter={(value) => formatCurrency(value)}
            showLegend={false}
          />
        </Card>

        {/* Plan Distribution */}
        <Card>
          <Title>Signups by Plan</Title>
          {planDistribution.length > 0 ? (
            <DonutChart
              className="mt-4 h-48"
              data={planDistribution}
              category="value"
              index="name"
              colors={['slate', 'blue', 'emerald', 'violet', 'amber']}
              valueFormatter={(value) => formatNumber(value)}
            />
          ) : (
            <div className="mt-4 h-48 flex items-center justify-center text-gray-400">
              No signups yet
            </div>
          )}
        </Card>
      </Grid>

      {/* Signups Table */}
      <Card>
        <Title>Recent Signups</Title>
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Plan</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Signed Up</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {signups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No signups yet
                </TableCell>
              </TableRow>
            ) : (
              signups.map((signup) => (
                <TableRow key={signup.id}>
                  <TableCell className="font-medium">{signup.email}</TableCell>
                  <TableCell>{signup.name || '-'}</TableCell>
                  <TableCell>
                    <Badge color={getPlanColor(signup.plan) as any}>{signup.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge color={getStatusColor(signup.status) as any}>{signup.status}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{signup.source || '-'}</TableCell>
                  <TableCell className="text-gray-500">{timeAgo(signup.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Activity Feed */}
      <Card>
        <Title>Recent Activity</Title>
        <div className="mt-4 space-y-3">
          {events.length === 0 ? (
            <Text className="text-gray-500 text-center py-8">No activity yet</Text>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div className="flex-1">
                  <Text className="font-medium">{event.type}</Text>
                  {event.email && <Text className="text-sm text-gray-500">{event.email}</Text>}
                </div>
                <Text className="text-sm text-gray-400">{timeAgo(event.created_at)}</Text>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

// Helper function to generate daily signups from signup data
function generateDailySignups(signups: Array<{ created_at: string }>) {
  const days: Record<string, number> = {}
  const now = new Date()

  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    days[key] = 0
  }

  // Count signups per day
  signups.forEach(s => {
    const date = new Date(s.created_at)
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (days[key] !== undefined) {
      days[key]++
    }
  })

  return Object.entries(days).map(([date, signups]) => ({ date, signups }))
}