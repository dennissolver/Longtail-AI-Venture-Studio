'use client'

import Link from 'next/link'
import { formatCurrency, formatNumber, calculateProgress, getStatusColor } from '@/lib/utils'
import { Card, Text, Flex, Badge, ProgressBar } from '@tremor/react'
import { ExternalLink, CreditCard, Users, Target } from 'lucide-react'

interface VentureCardProps {
  venture: {
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
}

export default function VentureCard({ venture }: VentureCardProps) {
  const progress = calculateProgress(venture.arr, venture.target_arr)
  
  // Calculate subscriber progress
  const subscribersNeeded = venture.subscribers_needed || Math.ceil(venture.target_arr / (500 * 12))
  const subscriberProgress = subscribersNeeded > 0 
    ? (venture.paid_customers / subscribersNeeded) * 100 
    : 0

  return (
    <Link href={`/dashboard/${venture.slug}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        {/* Header */}
        <Flex justifyContent="between" alignItems="start" className="mb-3">
          <div className="flex-1 min-w-0">
            <Flex justifyContent="start" alignItems="center" className="gap-2 mb-1">
              <Text className="font-semibold text-lg truncate">{venture.name}</Text>
              {venture.stripe_configured && (
                <CreditCard className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              )}
            </Flex>
            {venture.tagline && (
              <Text className="text-sm text-gray-500 truncate">{venture.tagline}</Text>
            )}
          </div>
          <Badge color={getStatusColor(venture.status) as any} size="sm">
            {venture.status}
          </Badge>
        </Flex>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-2">
            <Text className="text-xs text-gray-500">MRR</Text>
            <Text className="font-semibold text-emerald-600">
              {formatCurrency(venture.mrr)}
            </Text>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <Text className="text-xs text-gray-500">ARR</Text>
            <Text className="font-semibold text-blue-600">
              {formatCurrency(venture.arr)}
            </Text>
          </div>
        </div>

        {/* Subscriber Progress */}
        <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
          <Flex justifyContent="between" alignItems="center" className="mb-1">
            <Flex justifyContent="start" alignItems="center" className="gap-1">
              <Target className="w-3 h-3 text-indigo-500" />
              <Text className="text-xs text-indigo-700">Subscribers to $1M</Text>
            </Flex>
            {venture.has_stripe_pricing && (
              <Badge color="emerald" size="xs">
                {formatCurrency(venture.lowest_monthly_price || 0)}/mo
              </Badge>
            )}
          </Flex>
          <Flex justifyContent="between" alignItems="baseline">
            <Text className="text-lg font-bold text-indigo-600">
              {venture.paid_customers}
            </Text>
            <Text className="text-sm text-gray-500">
              / {formatNumber(subscribersNeeded)} needed
            </Text>
          </Flex>
          <ProgressBar 
            value={Math.min(subscriberProgress, 100)} 
            color="indigo" 
            className="h-1.5 mt-1" 
          />
        </div>

        {/* Signups Row */}
        <Flex justifyContent="between" alignItems="center" className="mb-3">
          <Flex justifyContent="start" alignItems="center" className="gap-1">
            <Users className="w-4 h-4 text-gray-400" />
            <Text className="text-sm text-gray-600">
              {formatNumber(venture.total_signups)} signups
            </Text>
          </Flex>
          <div className="flex gap-1">
            <Badge color="emerald" size="xs">{venture.paid_customers} paid</Badge>
            {venture.trialing_customers ? (
              <Badge color="blue" size="xs">{venture.trialing_customers} trial</Badge>
            ) : null}
          </div>
        </Flex>

        {/* ARR Progress */}
        <div>
          <Flex justifyContent="between" className="mb-1">
            <Text className="text-xs text-gray-500">ARR Progress</Text>
            <Text className="text-xs font-medium">{progress.toFixed(1)}%</Text>
          </Flex>
          <ProgressBar value={progress} color="blue" className="h-1.5" />
        </div>

        {/* Visit Site Link */}
        {venture.url && (
          <Flex justifyContent="end" className="mt-3 pt-3 border-t">
            <span 
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              onClick={(e) => {
                e.preventDefault()
                window.open(venture.url!, '_blank')
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Visit Site
            </span>
          </Flex>
        )}
      </Card>
    </Link>
  )
}
