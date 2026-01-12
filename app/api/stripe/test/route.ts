// app/api/stripe/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const { stripeSecretKey } = await request.json();

    if (!stripeSecretKey) {
      return NextResponse.json({
        success: false,
        message: 'No API Key Provided',
        details: 'Please enter a Stripe secret key'
      });
    }

    if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
      return NextResponse.json({
        success: false,
        message: 'Invalid Key Format',
        details: 'Stripe secret keys should start with sk_test_ or sk_live_'
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia'
    });

    const account = await stripe.accounts.retrieve();

    const [products, subscriptions] = await Promise.all([
      stripe.products.list({ limit: 1, active: true }),
      stripe.subscriptions.list({ limit: 1, status: 'active' })
    ]);

    const isTestMode = stripeSecretKey.startsWith('sk_test_');

    return NextResponse.json({
      success: true,
      message: 'Connection Successful!',
      details: `Connected to ${account.business_profile?.name || 'Stripe account'} (${isTestMode ? 'Test Mode' : 'Live Mode'})`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Invalid API Key')) {
      return NextResponse.json({
        success: false,
        message: 'Invalid API Key',
        details: 'The provided API key is not valid.'
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Connection Failed',
      details: errorMessage
    });
  }
}
