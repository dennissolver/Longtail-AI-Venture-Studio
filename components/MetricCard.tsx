// components/MetricCard.tsx
'use client';

import { Card, Text, Metric, Flex, Badge, Icon } from '@tremor/react';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CreditCardIcon,
  KeyIcon,
  CubeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import type { StripeStatus } from '@/lib/stripe-status';

type MetricCardProps = {
  title: string;
  value?: string | number;
  subtext?: string;
  stripeStatus?: StripeStatus;
  color?: 'emerald' | 'amber' | 'red' | 'blue' | 'gray';
  icon?: React.ElementType;
  loading?: boolean;
};

const statusConfig = {
  needs_stripe_key: {
    icon: KeyIcon,
    color: 'amber' as const,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  needs_webhook_secret: {
    icon: KeyIcon,
    color: 'amber' as const,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  needs_env_vars: {
    icon: ExclamationTriangleIcon,
    color: 'amber' as const,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  no_products: {
    icon: CubeIcon,
    color: 'blue' as const,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200'
  },
  no_data: {
    icon: ChartBarIcon,
    color: 'gray' as const,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200'
  },
  error: {
    icon: ExclamationCircleIcon,
    color: 'red' as const,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200'
  },
  ready: {
    icon: CreditCardIcon,
    color: 'emerald' as const,
    bgColor: 'bg-white',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-200'
  }
};

export function MetricCard({
  title,
  value,
  subtext,
  stripeStatus,
  color = 'blue',
  icon,
  loading = false
}: MetricCardProps) {
  // Show loading state
  if (loading) {
    return (
      <Card className="animate-pulse">
        <Text>{title}</Text>
        <div className="h-8 bg-gray-200 rounded mt-2 w-24"></div>
        <div className="h-4 bg-gray-100 rounded mt-2 w-32"></div>
      </Card>
    );
  }

  // Show error state if Stripe isn't configured or has issues
  if (stripeStatus && stripeStatus.status !== 'ready') {
    const config = statusConfig[stripeStatus.status];
    const StatusIcon = config.icon;

    return (
      <Card className={`${config.bgColor} ${config.borderColor} border`}>
        <Text className="text-gray-600">{title}</Text>
        <Flex className="mt-2 gap-2" alignItems="center">
          <StatusIcon className={`h-6 w-6 ${config.textColor}`} />
          <div>
            <Text className={`font-semibold ${config.textColor}`}>
              {stripeStatus.message}
            </Text>
            {stripeStatus.details && (
              <Text className="text-xs text-gray-500 mt-0.5">
                {stripeStatus.details}
              </Text>
            )}
          </div>
        </Flex>
        <Badge color={config.color} className="mt-3" size="sm">
          Setup Required
        </Badge>
      </Card>
    );
  }

  // Show normal metric
  return (
    <Card>
      <Flex alignItems="start">
        <div>
          <Text>{title}</Text>
          <Metric className={`text-${color}-600`}>
            {value ?? '—'}
          </Metric>
          {subtext && (
            <Text className="text-gray-500 text-sm mt-1">{subtext}</Text>
          )}
        </div>
        {icon && (
          <Icon
            icon={icon}
            color={color}
            variant="light"
            size="lg"
          />
        )}
      </Flex>
    </Card>
  );
}

// Specialized card for ARR target that shows subscriber count needed
export function ARRTargetCard({
  title = 'Subscribers to $1M ARR',
  currentSubscribers,
  targetSubscribers,
  avgPlanPrice,
  stripeStatus
}: {
  title?: string;
  currentSubscribers?: number;
  targetSubscribers?: number;
  avgPlanPrice?: number;
  stripeStatus?: StripeStatus;
}) {
  // Show error state if Stripe isn't configured
  if (stripeStatus && stripeStatus.status !== 'ready') {
    const config = statusConfig[stripeStatus.status];
    const StatusIcon = config.icon;

    return (
      <Card className={`${config.bgColor} ${config.borderColor} border`}>
        <Text className="text-gray-600">{title}</Text>
        <Flex className="mt-2 gap-2" alignItems="center">
          <StatusIcon className={`h-6 w-6 ${config.textColor}`} />
          <div>
            <Text className={`font-semibold ${config.textColor}`}>
              {stripeStatus.message}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {stripeStatus.status === 'no_products'
                ? 'Create pricing plans in Stripe to calculate target'
                : stripeStatus.details}
            </Text>
          </div>
        </Flex>
      </Card>
    );
  }

  // No price data available
  if (!avgPlanPrice || avgPlanPrice === 0) {
    return (
      <Card className="bg-gray-50 border border-gray-200">
        <Text className="text-gray-600">{title}</Text>
        <Flex className="mt-2 gap-2" alignItems="center">
          <CubeIcon className="h-6 w-6 text-gray-500" />
          <div>
            <Text className="font-semibold text-gray-600">
              No Pricing Data
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              Add products with prices to Stripe
            </Text>
          </div>
        </Flex>
      </Card>
    );
  }

  const progress = targetSubscribers && targetSubscribers > 0
    ? Math.round((currentSubscribers || 0) / targetSubscribers * 100)
    : 0;

  return (
    <Card>
      <Text>{title}</Text>
      <Flex className="mt-2" alignItems="baseline" justifyContent="start">
        <Metric className="text-blue-600">
          {currentSubscribers?.toLocaleString() ?? 0}
        </Metric>
        <Text className="ml-2">
          / {targetSubscribers?.toLocaleString() ?? '—'} needed
        </Text>
      </Flex>
      <Text className="text-gray-500 text-sm mt-1">
        Based on ${avgPlanPrice}/mo avg plan price
      </Text>
      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <Text className="text-xs text-gray-500 mt-1">
        {progress}% to target
      </Text>
    </Card>
  );
}