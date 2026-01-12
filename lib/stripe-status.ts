// lib/stripe-status.ts
// Utility to check Stripe configuration status for each venture

export type StripeStatus = {
  status: 'ready' | 'needs_stripe_key' | 'needs_webhook_secret' | 'needs_env_vars' | 'no_products' | 'no_data' | 'error';
  message: string;
  details?: string;
};

export type VentureStripeConfig = {
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  hasProducts?: boolean;
  hasSubscriptions?: boolean;
  error?: string;
};

export function getStripeStatus(config: VentureStripeConfig): StripeStatus {
  // Check if Stripe secret key is configured
  if (!config.stripeSecretKey) {
    return {
      status: 'needs_stripe_key',
      message: 'Needs Stripe API Key',
      details: 'Add STRIPE_SECRET_KEY in venture settings'
    };
  }

  // Check if webhook secret is configured (needed for real-time updates)
  if (!config.stripeWebhookSecret) {
    return {
      status: 'needs_webhook_secret',
      message: 'Needs Webhook Secret',
      details: 'Add STRIPE_WEBHOOK_SECRET for real-time sync'
    };
  }

  // Check if there was an error connecting to Stripe
  if (config.error) {
    return {
      status: 'error',
      message: 'Stripe Connection Error',
      details: config.error
    };
  }

  // Check if products/prices are configured in Stripe
  if (config.hasProducts === false) {
    return {
      status: 'no_products',
      message: 'No Products in Stripe',
      details: 'Create products and prices in Stripe Dashboard'
    };
  }

  // Check if there are any subscriptions/customers
  if (config.hasSubscriptions === false) {
    return {
      status: 'no_data',
      message: 'No Subscription Data',
      details: 'No customers or subscriptions found yet'
    };
  }

  return {
    status: 'ready',
    message: 'Connected',
    details: 'Stripe is configured and syncing'
  };
}

// Check environment variables at runtime
export function checkStripeEnvVars(): {
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
} {
  return {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasPublishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  };
}