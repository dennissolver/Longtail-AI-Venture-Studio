// app/api/ventures/[slug]/setup-stripe/route.ts
// API route to automatically set up Stripe products, prices, and webhooks for a venture

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://longtail-ai-venture-studio.vercel.app';

// Default pricing tiers - can be customized per venture
const DEFAULT_PLANS = [
  {
    name: 'Starter',
    description: 'For individuals and small teams',
    monthlyPrice: 49,
    yearlyPrice: 490,
    features: ['Core features', 'Email support', 'Basic analytics']
  },
  {
    name: 'Pro',
    description: 'For growing businesses',
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: ['All Starter features', 'Priority support', 'Advanced analytics', 'Integrations']
  },
  {
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    features: ['All Pro features', '24/7 support', 'Custom integrations', 'Dedicated manager']
  }
];

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { plans = DEFAULT_PLANS } = body;

    // Get venture with Stripe key
    const { data: venture, error: ventureError } = await supabase
      .from('ventures')
      .select('id, name, slug, stripe_secret_key, stripe_webhook_secret')
      .eq('slug', slug)
      .single();

    if (ventureError || !venture) {
      return NextResponse.json(
        { error: 'Venture not found' },
        { status: 404 }
      );
    }

    if (!venture.stripe_secret_key) {
      return NextResponse.json(
        { error: 'Stripe secret key not configured. Add it in venture settings first.' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(venture.stripe_secret_key, {
      apiVersion: '2025-02-24.acacia'
    });

    const results = {
      productsCreated: 0,
      pricesCreated: 0,
      webhookCreated: false,
      webhookSecret: null as string | null,
      products: [] as Array<{ name: string; id: string; prices: any[] }>
    };

    // Create products and prices
    for (const plan of plans) {
      const productName = `${venture.name} ${plan.name}`;

      // Check if product exists
      const existingProducts = await stripe.products.search({
        query: `name:"${productName}"`
      });

      let product: Stripe.Product;

      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
      } else {
        product = await stripe.products.create({
          name: productName,
          description: plan.description,
          metadata: {
            venture: slug,
            plan_tier: plan.name.toLowerCase(),
            features: plan.features.join(', ')
          }
        });
        results.productsCreated++;
      }

      const productPrices: any[] = [];

      // Get existing prices
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true
      });

      // Create monthly price if doesn't exist
      let monthlyPrice = existingPrices.data.find(p => p.recurring?.interval === 'month');
      if (!monthlyPrice) {
        monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.monthlyPrice * 100,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { venture: slug, plan_tier: plan.name.toLowerCase() }
        });
        results.pricesCreated++;
      }
      productPrices.push({
        id: monthlyPrice.id,
        amount: plan.monthlyPrice,
        interval: 'month'
      });

      // Create yearly price if specified
      if (plan.yearlyPrice) {
        let yearlyPrice = existingPrices.data.find(p => p.recurring?.interval === 'year');
        if (!yearlyPrice) {
          yearlyPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.yearlyPrice * 100,
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { venture: slug, plan_tier: plan.name.toLowerCase() }
          });
          results.pricesCreated++;
        }
        productPrices.push({
          id: yearlyPrice.id,
          amount: plan.yearlyPrice,
          interval: 'year'
        });
      }

      results.products.push({
        name: productName,
        id: product.id,
        prices: productPrices
      });
    }

    // Set up webhook
    const webhookUrl = `${DASHBOARD_URL}/api/webhooks/stripe?venture=${slug}`;

    const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    let webhook = existingWebhooks.data.find(w => w.url === webhookUrl);

    if (!webhook) {
      webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed',
          'customer.created'
        ],
        metadata: { venture: slug }
      });
      results.webhookCreated = true;
      results.webhookSecret = webhook.secret || null;

      // Save webhook secret to database
      if (webhook.secret) {
        await supabase
          .from('ventures')
          .update({
            stripe_webhook_secret: webhook.secret,
            updated_at: new Date().toISOString()
          })
          .eq('slug', slug);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Stripe setup complete for ${venture.name}`,
      results
    });

  } catch (error) {
    console.error('Stripe setup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Stripe setup failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}