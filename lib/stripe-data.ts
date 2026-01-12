// lib/stripe-data.ts
// Fetch Stripe data for a venture with proper error handling

import Stripe from 'stripe';
import { getStripeStatus, type StripeStatus, type VentureStripeConfig } from './stripe-status';

export type VentureStripeData = {
  status: StripeStatus;
  data: {
    totalRevenue: number;
    mrr: number;
    activeSubscriptions: number;
    totalCustomers: number;
    churnedCustomers: number;
    churnRate: number;
    avgPlanPrice: number;
    subscribersToTarget: number;
    plans: Array<{
      id: string;
      name: string;
      price: number;
      interval: string;
      activeCount: number;
    }>;
  } | null;
};

const TARGET_ARR = 1_000_000; // $1M ARR target

export async function fetchVentureStripeData(
  stripeSecretKey?: string | null,
  stripeWebhookSecret?: string | null
): Promise<VentureStripeData> {

  // Build config for status check
  const config: VentureStripeConfig = {
    stripeSecretKey,
    stripeWebhookSecret
  };

  // Check if keys are provided
  if (!stripeSecretKey) {
    return {
      status: getStripeStatus(config),
      data: null
    };
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia'
    });

    // Fetch products and prices
    const [products, prices, subscriptions, customers] = await Promise.all([
      stripe.products.list({ limit: 100, active: true }),
      stripe.prices.list({ limit: 100, active: true }),
      stripe.subscriptions.list({ limit: 100, status: 'active' }),
      stripe.customers.list({ limit: 100 })
    ]);

    // Check if products exist
    if (products.data.length === 0) {
      return {
        status: getStripeStatus({ ...config, hasProducts: false }),
        data: null
      };
    }

    // Calculate MRR from active subscriptions
    let mrr = 0;
    const planCounts: Record<string, number> = {};

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const price = item.price;
        const amount = price.unit_amount || 0;

        // Normalize to monthly
        let monthlyAmount = amount;
        if (price.recurring?.interval === 'year') {
          monthlyAmount = amount / 12;
        } else if (price.recurring?.interval === 'week') {
          monthlyAmount = amount * 4;
        }

        mrr += monthlyAmount / 100; // Convert from cents

        // Count by plan
        const planId = price.id;
        planCounts[planId] = (planCounts[planId] || 0) + 1;
      }
    }

    // Build plans list with counts
    const plans = prices.data
      .filter(p => p.recurring)
      .map(price => {
        const product = products.data.find(prod => prod.id === price.product);
        let monthlyPrice = (price.unit_amount || 0) / 100;
        if (price.recurring?.interval === 'year') {
          monthlyPrice = monthlyPrice / 12;
        }

        return {
          id: price.id,
          name: product?.name || 'Unknown Plan',
          price: monthlyPrice,
          interval: price.recurring?.interval || 'month',
          activeCount: planCounts[price.id] || 0
        };
      })
      .sort((a, b) => b.activeCount - a.activeCount);

    // Calculate average plan price (weighted by active subscriptions, or simple average if no subs)
    let avgPlanPrice = 0;
    if (subscriptions.data.length > 0) {
      avgPlanPrice = mrr / subscriptions.data.length;
    } else if (plans.length > 0) {
      avgPlanPrice = plans.reduce((sum, p) => sum + p.price, 0) / plans.length;
    }

    // Calculate subscribers needed for $1M ARR
    const subscribersToTarget = avgPlanPrice > 0
      ? Math.ceil(TARGET_ARR / 12 / avgPlanPrice)
      : 0;

    // Fetch revenue data (simplified - in production use balance transactions)
    const charges = await stripe.charges.list({ limit: 100 });
    const totalRevenue = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + (c.amount / 100), 0);

    // Calculate churn (customers who cancelled)
    const cancelledSubs = await stripe.subscriptions.list({
      limit: 100,
      status: 'canceled'
    });
    const churnedCustomers = cancelledSubs.data.length;
    const totalWithHistory = subscriptions.data.length + churnedCustomers;
    const churnRate = totalWithHistory > 0
      ? (churnedCustomers / totalWithHistory) * 100
      : 0;

    // Check if there's any subscription data
    if (subscriptions.data.length === 0 && customers.data.length === 0) {
      return {
        status: getStripeStatus({ ...config, hasProducts: true, hasSubscriptions: false }),
        data: {
          totalRevenue,
          mrr: 0,
          activeSubscriptions: 0,
          totalCustomers: 0,
          churnedCustomers: 0,
          churnRate: 0,
          avgPlanPrice,
          subscribersToTarget,
          plans
        }
      };
    }

    return {
      status: { status: 'ready', message: 'Connected' },
      data: {
        totalRevenue,
        mrr,
        activeSubscriptions: subscriptions.data.length,
        totalCustomers: customers.data.length,
        churnedCustomers,
        churnRate: Math.round(churnRate * 10) / 10,
        avgPlanPrice: Math.round(avgPlanPrice * 100) / 100,
        subscribersToTarget,
        plans
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific Stripe errors
    if (errorMessage.includes('Invalid API Key')) {
      return {
        status: {
          status: 'error',
          message: 'Invalid Stripe Key',
          details: 'The API key is invalid or expired'
        },
        data: null
      };
    }

    return {
      status: {
        status: 'error',
        message: 'Stripe Error',
        details: errorMessage
      },
      data: null
    };
  }
}

// Fetch Stripe status for multiple ventures at once
export async function fetchAllVenturesStripeData(
  ventures: Array<{
    slug: string;
    stripeSecretKey?: string | null;
    stripeWebhookSecret?: string | null;
  }>
): Promise<Record<string, VentureStripeData>> {
  const results: Record<string, VentureStripeData> = {};

  await Promise.all(
    ventures.map(async (venture) => {
      results[venture.slug] = await fetchVentureStripeData(
        venture.stripeSecretKey,
        venture.stripeWebhookSecret
      );
    })
  );

  return results;
}