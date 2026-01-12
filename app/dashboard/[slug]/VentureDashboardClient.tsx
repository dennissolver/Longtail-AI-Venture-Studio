// app/dashboard/[slug]/VentureDashboardClient.tsx
'use client';

import { Card, Title, Text, Grid, Flex, Badge, AreaChart, DonutChart } from '@tremor/react';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { MetricCard, ARRTargetCard } from '@/components/MetricCard';
import type { VentureStripeData } from '@/lib/stripe-data';

type Props = {
  venture: {
    id: string;
    name: string;
    slug: string;
    stripe_secret_key?: string | null;
    stripe_webhook_secret?: string | null;
  };
  stripeData: VentureStripeData;
  recentSignups: Array<{
    id: string;
    email: string;
    name?: string;
    plan?: string;
    status?: string;
    created_at: string;
  }>;
};

export function VentureDashboardClient({ venture, stripeData, recentSignups }: Props) {
  const { status, data } = stripeData;
  const isReady = status.status === 'ready';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <Flex justifyContent="between" alignItems="center">
        <div>
          <Title>{venture.name}</Title>
          <Text className="text-gray-500">Dashboard & Analytics</Text>
        </div>
        <Flex className="gap-3">
          {/* Stripe Status Badge */}
          <Badge
            color={isReady ? 'emerald' : status.status === 'error' ? 'red' : 'amber'}
            size="lg"
          >
            {isReady ? '● Stripe Connected' : `● ${status.message}`}
          </Badge>
          <Link href={`/dashboard/${venture.slug}/settings`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              <Cog6ToothIcon className="h-4 w-4" />
              Settings
            </button>
          </Link>
        </Flex>
      </Flex>

      {/* Setup Alert - Show if Stripe isn't ready */}
      {!isReady && (
        <Card className="bg-amber-50 border border-amber-200">
          <Flex className="gap-3" alignItems="start">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <Text className="font-semibold text-amber-800">
                {status.message}
              </Text>
              <Text className="text-amber-700 mt-1">
                {status.details}
              </Text>
              <Link
                href={`/dashboard/${venture.slug}/settings`}
                className="inline-block mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
              >
                Configure Stripe →
              </Link>
            </div>
          </Flex>
        </Card>
      )}

      {/* ARR Progress */}
      <Card>
        <Text>Progress to $1M ARR</Text>
        <Flex className="mt-2" alignItems="baseline">
          <Title className="text-3xl">
            ${data ? (data.mrr * 12).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
          </Title>
          <Text className="ml-2 text-gray-500">/ $1,000,000</Text>
        </Flex>
        <div className="mt-3 w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{
              width: data
                ? `${Math.min((data.mrr * 12 / 1000000) * 100, 100)}%`
                : '0%'
            }}
          />
        </div>
        <Text className="text-sm text-gray-500 mt-2">
          {data
            ? `${((data.mrr * 12 / 1000000) * 100).toFixed(2)}% complete`
            : 'Connect Stripe to track ARR'
          }
        </Text>
      </Card>

      {/* Metric Cards */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-4">
        <MetricCard
          title="Total Revenue"
          value={data ? `$${data.totalRevenue.toLocaleString()}` : undefined}
          stripeStatus={!isReady ? status : undefined}
          icon={CurrencyDollarIcon}
          color="emerald"
        />

        <MetricCard
          title="Monthly Recurring Revenue"
          value={data ? `$${data.mrr.toLocaleString()}` : undefined}
          subtext={data ? `${data.activeSubscriptions} active subscriptions` : undefined}
          stripeStatus={!isReady ? status : undefined}
          icon={ArrowTrendingUpIcon}
          color="blue"
        />

        <MetricCard
          title="Total Signups"
          value={recentSignups.length > 0 || data ?
            (data?.totalCustomers || recentSignups.length).toString() : undefined}
          subtext={data ? `${data.activeSubscriptions} paid (${
            data.totalCustomers > 0 
              ? Math.round((data.activeSubscriptions / data.totalCustomers) * 100) 
              : 0
          }% conversion)` : undefined}
          stripeStatus={!isReady && recentSignups.length === 0 ? status : undefined}
          icon={UserGroupIcon}
          color="blue"
        />

        <MetricCard
          title="Active Customers"
          value={data?.activeSubscriptions?.toString()}
          subtext={data ? `${data.churnedCustomers} churned (${data.churnRate}%)` : undefined}
          stripeStatus={!isReady ? status : undefined}
          icon={ChartBarIcon}
          color={data && data.churnRate > 10 ? 'red' : data && data.churnRate > 5 ? 'amber' : 'emerald'}
        />
      </Grid>

      {/* Subscribers to $1M Target */}
      <Grid numItemsSm={1} numItemsLg={2} className="gap-4">
        <ARRTargetCard
          title="Subscribers to $1M ARR"
          currentSubscribers={data?.activeSubscriptions}
          targetSubscribers={data?.subscribersToTarget}
          avgPlanPrice={data?.avgPlanPrice}
          stripeStatus={!isReady ? status : undefined}
        />

        {/* Pricing Plans Card */}
        <Card>
          <Title>Pricing Plans</Title>
          {!isReady ? (
            <Flex className="mt-4 gap-2" alignItems="center">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              <Text className="text-amber-700">{status.message}</Text>
            </Flex>
          ) : data && data.plans.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.plans.map(plan => (
                <Flex key={plan.id} justifyContent="between" alignItems="center">
                  <div>
                    <Text className="font-medium">{plan.name}</Text>
                    <Text className="text-sm text-gray-500">
                      ${plan.price}/{plan.interval}
                    </Text>
                  </div>
                  <Badge color="blue">{plan.activeCount} active</Badge>
                </Flex>
              ))}
            </div>
          ) : (
            <Text className="mt-4 text-gray-500">No pricing plans configured in Stripe</Text>
          )}
        </Card>
      </Grid>

      {/* Charts - Only show if we have data */}
      {isReady && data && (
        <Grid numItemsSm={1} numItemsLg={2} className="gap-4">
          {/* Revenue Chart - placeholder, would need historical data */}
          <Card>
            <Title>Revenue (Last 6 Months)</Title>
            <Text className="text-gray-500 mt-2">
              Historical data will appear as revenue accumulates
            </Text>
          </Card>

          {/* Plan Distribution */}
          {data.plans.length > 0 && (
            <Card>
              <Title>Subscriptions by Plan</Title>
              <DonutChart
                className="mt-4 h-48"
                data={data.plans.filter(p => p.activeCount > 0).map(p => ({
                  name: p.name,
                  value: p.activeCount
                }))}
                category="value"
                index="name"
                colors={['blue', 'cyan', 'indigo', 'violet', 'purple']}
              />
            </Card>
          )}
        </Grid>
      )}

      {/* Recent Signups Table */}
      <Card>
        <Title>Recent Signups</Title>
        {recentSignups.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Plan</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map(signup => (
                  <tr key={signup.id} className="border-b">
                    <td className="py-2 px-3">{signup.email}</td>
                    <td className="py-2 px-3">{signup.name || '—'}</td>
                    <td className="py-2 px-3">
                      <Badge color={signup.plan === 'free' ? 'gray' : 'blue'}>
                        {signup.plan || 'Free'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge color={signup.status === 'active' ? 'emerald' : 'gray'}>
                        {signup.status || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {new Date(signup.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Text className="mt-4 text-gray-500">
            No signups recorded yet. Signups will appear here when tracking is configured.
          </Text>
        )}
      </Card>
    </div>
  );
}