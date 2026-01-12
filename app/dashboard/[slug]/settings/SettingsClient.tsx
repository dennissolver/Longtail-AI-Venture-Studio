// app/dashboard/[slug]/settings/SettingsClient.tsx
'use client';

import { useState } from 'react';
import { Card, Title, Text, TextInput, Button, Flex, Badge, Callout, Divider } from '@tremor/react';
import {
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  RocketLaunchIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

type Props = {
  venture: {
    id: string;
    name: string;
    slug: string;
    stripe_secret_key?: string | null;
    stripe_webhook_secret?: string | null;
  };
};

type TestResult = {
  success: boolean;
  message: string;
  details?: string;
};

type SetupResult = {
  success: boolean;
  message: string;
  results?: {
    productsCreated: number;
    pricesCreated: number;
    webhookCreated: boolean;
    products: Array<{ name: string; id: string; prices: any[] }>;
  };
  error?: string;
};

export function SettingsClient({ venture }: Props) {
  const [stripeSecretKey, setStripeSecretKey] = useState(venture.stripe_secret_key || '');
  const [webhookSecret, setWebhookSecret] = useState(venture.stripe_webhook_secret || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);

  const maskKey = (key: string) => {
    if (!key || key.length < 12) return key;
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/stripe/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeSecretKey })
      });

      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed',
        details: 'Unable to reach server'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const res = await fetch(`/api/ventures/${venture.slug}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_secret_key: stripeSecretKey,
          stripe_webhook_secret: webhookSecret
        })
      });

      if (res.ok) {
        setSaveResult({ success: true, message: 'Settings saved successfully!' });
      } else {
        const data = await res.json();
        setSaveResult({ success: false, message: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setSaveResult({ success: false, message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSetup = async () => {
    setSettingUp(true);
    setSetupResult(null);

    try {
      // First save the key if it's new
      if (stripeSecretKey && stripeSecretKey !== venture.stripe_secret_key) {
        await fetch(`/api/ventures/${venture.slug}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripe_secret_key: stripeSecretKey })
        });
      }

      // Then run auto-setup
      const res = await fetch(`/api/ventures/${venture.slug}/setup-stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (res.ok) {
        setSetupResult({
          success: true,
          message: data.message,
          results: data.results
        });
        // Update webhook secret if it was created
        if (data.results?.webhookSecret) {
          setWebhookSecret(data.results.webhookSecret);
        }
      } else {
        setSetupResult({
          success: false,
          message: 'Setup failed',
          error: data.error
        });
      }
    } catch (error) {
      setSetupResult({
        success: false,
        message: 'Setup failed',
        error: 'Unable to reach server'
      });
    } finally {
      setSettingUp(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/${venture.slug}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <Title>{venture.name} - Settings</Title>
        <Text className="text-gray-500">Configure Stripe integration</Text>
      </div>

      {/* Current Status */}
      <Card>
        <Flex justifyContent="between" alignItems="center">
          <Title className="text-lg">Integration Status</Title>
          <Badge
            color={venture.stripe_secret_key ? 'emerald' : 'amber'}
            size="lg"
          >
            {venture.stripe_secret_key ? 'Configured' : 'Not Configured'}
          </Badge>
        </Flex>

        <div className="mt-4 space-y-2">
          <Flex justifyContent="between">
            <Text>Stripe API Key</Text>
            <Text className={venture.stripe_secret_key ? 'text-emerald-600' : 'text-amber-600'}>
              {venture.stripe_secret_key ? maskKey(venture.stripe_secret_key) : 'Not set'}
            </Text>
          </Flex>
          <Flex justifyContent="between">
            <Text>Webhook Secret</Text>
            <Text className={venture.stripe_webhook_secret ? 'text-emerald-600' : 'text-amber-600'}>
              {venture.stripe_webhook_secret ? maskKey(venture.stripe_webhook_secret) : 'Not set'}
            </Text>
          </Flex>
        </div>
      </Card>

      {/* Quick Setup - NEW */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <Flex alignItems="start" className="gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <RocketLaunchIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <Title className="text-lg">Quick Setup</Title>
            <Text className="text-gray-600 mt-1">
              Automatically create products, pricing plans, and webhooks in your Stripe account.
            </Text>

            <div className="mt-4 p-3 bg-white rounded-lg border">
              <Text className="font-medium text-sm">This will create:</Text>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• <strong>Starter</strong> plan - $49/mo ($490/yr)</li>
                <li>• <strong>Pro</strong> plan - $99/mo ($990/yr)</li>
                <li>• <strong>Enterprise</strong> plan - $299/mo ($2,990/yr)</li>
                <li>• Webhook endpoint for real-time sync</li>
              </ul>
            </div>

            {setupResult && (
              <Callout
                className="mt-4"
                title={setupResult.message}
                icon={setupResult.success ? CheckCircleIcon : ExclamationCircleIcon}
                color={setupResult.success ? 'emerald' : 'red'}
              >
                {setupResult.success && setupResult.results && (
                  <div className="mt-2 text-sm">
                    <p>✓ {setupResult.results.productsCreated} products created</p>
                    <p>✓ {setupResult.results.pricesCreated} prices created</p>
                    <p>✓ Webhook {setupResult.results.webhookCreated ? 'created' : 'already exists'}</p>
                  </div>
                )}
                {setupResult.error && <p>{setupResult.error}</p>}
              </Callout>
            )}

            <Button
              className="mt-4"
              icon={RocketLaunchIcon}
              onClick={handleAutoSetup}
              disabled={!stripeSecretKey || settingUp}
              loading={settingUp}
              color="blue"
            >
              {settingUp ? 'Setting up...' : 'Auto-Setup Stripe'}
            </Button>

            {!stripeSecretKey && (
              <Text className="text-amber-600 text-sm mt-2">
                ↓ Enter your Stripe Secret Key below first
              </Text>
            )}
          </div>
        </Flex>
      </Card>

      <Divider>Or configure manually</Divider>

      {/* Manual Configuration Form */}
      <Card>
        <Title className="text-lg">Manual Configuration</Title>
        <Text className="text-gray-500 mt-1">
          Get these keys from your{' '}
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Stripe Dashboard
          </a>
        </Text>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stripe Secret Key
            </label>
            <TextInput
              placeholder="sk_live_... or sk_test_..."
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              icon={KeyIcon}
            />
            <Text className="text-xs text-gray-500 mt-1">
              Use test keys (sk_test_) for testing, live keys (sk_live_) for production
            </Text>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook Secret (auto-filled by Quick Setup)
            </label>
            <TextInput
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              icon={KeyIcon}
            />
          </div>
        </div>

        {/* Test Connection */}
        {testResult && (
          <Callout
            className="mt-4"
            title={testResult.message}
            icon={testResult.success ? CheckCircleIcon : ExclamationCircleIcon}
            color={testResult.success ? 'emerald' : 'red'}
          >
            {testResult.details}
          </Callout>
        )}

        {/* Save Result */}
        {saveResult && (
          <Callout
            className="mt-4"
            title={saveResult.message}
            icon={saveResult.success ? CheckCircleIcon : ExclamationCircleIcon}
            color={saveResult.success ? 'emerald' : 'red'}
          />
        )}

        {/* Action Buttons */}
        <Flex className="mt-6 gap-3" justifyContent="end">
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={!stripeSecretKey || testing}
            icon={ArrowPathIcon}
            loading={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            loading={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Flex>
      </Card>

      {/* Products Created */}
      {setupResult?.success && setupResult.results?.products && (
        <Card>
          <Flex alignItems="center" className="gap-2 mb-4">
            <CubeIcon className="h-5 w-5 text-gray-500" />
            <Title className="text-lg">Products Created</Title>
          </Flex>
          <div className="space-y-3">
            {setupResult.results.products.map((product) => (
              <div key={product.id} className="p-3 bg-gray-50 rounded-lg">
                <Text className="font-medium">{product.name}</Text>
                <Flex className="mt-1 gap-2">
                  {product.prices.map((price: any) => (
                    <Badge key={price.id} color="blue" size="sm">
                      ${price.amount}/{price.interval === 'month' ? 'mo' : 'yr'}
                    </Badge>
                  ))}
                </Flex>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}