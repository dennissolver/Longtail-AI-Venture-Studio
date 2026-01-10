'use client'

import Link from 'next/link'
import { Card, Text, Metric, Flex, ProgressBar, Badge, Button } from '@tremor/react'
import { formatCurrency, calculateProgress, getStatusColor } from '@/lib/utils'
import { ArrowRight, ExternalLink, Target } from 'lucide-react'

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
  }
}

export default function VentureCard({ venture }: VentureCardProps) {
  const progress = calculateProgress(venture.arr, venture.target_arr)

  // Calculate subscribers needed
  const avgRevenuePerUser = venture.paid_customers > 0
    ? venture.arr / venture.paid_customers
    : 500 * 12 // Default: $500/mo
  const subscribersNeeded = Math.ceil(venture.target_arr / avgRevenuePerUser)
  const subscribersRemaining = Math.max(0, subscribersNeeded - venture.paid_customers)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <Flex justifyContent="between" alignItems="start">
        <div>
          <Flex justifyContent="start" alignItems="center" className="gap-2">
            <Text className="font-semibold text-gray-900">{venture.name}</Text>
            <Badge color={getStatusColor(venture.status)} size="xs">
              {venture.status}
            </Badge>
          </Flex>
          {venture.tagline && (
            <Text className="text-gray-500 text-sm mt-1">{venture.tagline}</Text>
          )}
        </div>
        {venture.url && (
          <a
            href={venture.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </Flex>

      <div className="mt-4 space-y-4">
        {/* ARR Progress */}
        <div>
          <Flex justifyContent="between" alignItems="center" className="mb-1">
            <Text className="text-sm">ARR Progress</Text>
            <Text className="text-sm font-medium">{progress.toFixed(1)}%</Text>
          </Flex>
          <ProgressBar value={progress} color="blue" className="h-2" />
          <Flex justifyContent="between" className="mt-1">
            <Text className="text-xs text-gray-400">{formatCurrency(venture.arr)}</Text>
            <Text className="text-xs text-gray-400">Target: {formatCurrency(venture.target_arr)}</Text>
          </Flex>
        </div>

        {/* Key Metrics */}
        <Flex justifyContent="between">
          <div>
            <Text className="text-xs text-gray-500">MRR</Text>
            <Text className="font-semibold">{formatCurrency(venture.mrr)}</Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Revenue</Text>
            <Text className="font-semibold">{formatCurrency(venture.total_revenue)}</Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Signups</Text>
            <Text className="font-semibold">{venture.total_signups}</Text>
            <Text className="text-xs text-emerald-600">({venture.paid_customers} paid)</Text>
          </div>
        </Flex>

        {/* Subscribers to Target */}
        <div className="pt-3 mt-3 border-t border-gray-100">
          <Flex justifyContent="start" alignItems="center" className="gap-1 mb-1">
            <Target className="w-3 h-3 text-indigo-500" />
            <Text className="text-xs text-gray-500">Need {subscribersRemaining} more subscribers to $1M</Text>
          </Flex>
          <ProgressBar
            value={(venture.paid_customers / subscribersNeeded) * 100}
            color="indigo"
            className="h-1"
          />
        </div>
      </div>

      {/* View Details Link */}
      <Link href={`/dashboard/${venture.slug}`}>
        <Button
          variant="light"
          icon={ArrowRight}
          iconPosition="right"
          className="mt-4 w-full"
        >
          View Details
        </Button>
      </Link>
    </Card>
  )
}