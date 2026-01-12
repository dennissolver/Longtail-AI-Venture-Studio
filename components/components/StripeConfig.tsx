'use client'

import { useState } from 'react'
import { Card, Title, Text, Button, TextInput, Flex, Badge, Callout } from '@tremor/react'
import { CreditCard, RefreshCw, CheckCircle, AlertTriangle, Key, Webhook } from 'lucide-react'

interface StripeConfigProps {
  ventureSlug: string
  isConfigured: boolean
  plansCount: number
  pricesCount: number
  activeSubscriptions: number
}

export default function StripeConfig({
  ventureSlug,
  isConfigured,
  plansCount,
  pricesCount,
  activeSubscriptions,
}: StripeConfigProps) {
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSaveKeys = async () => {
    if (!secretKey.startsWith('sk_')) {
      setMessage({ type: 'error', text: 'Invalid secret key. Must start with sk_live_ or sk_test_' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/ventures/${ventureSlug}/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stripe_secret_key: secretKey,
          stripe_webhook_secret: webhookSecret || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to save')
      }

      setMessage({ type: 'success', text: 'Stripe keys saved successfully!' })
      setSecretKey('')
      setWebhookSecret('')
      
      // Refresh page to show updated status
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/ventures/${ventureSlug}/stripe/sync`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Sync failed')
      }

      const data = await res.json()
      setMessage({ 
        type: 'success', 
        text: `Synced ${data.plans} plans, ${data.prices} prices, ${data.subscriptions} subscriptions` 
      })
      
      // Refresh page to show updated data
      setTimeout(() => window.location.reload(), 2000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <Flex justifyContent="between" alignItems="center" className="mb-4">
        <Flex justifyContent="start" alignItems="center" className="gap-2">
          <CreditCard className="w-5 h-5 text-violet-500" />
          <Title>Stripe Integration</Title>
        </Flex>
        {isConfigured ? (
          <Badge color="emerald" size="lg">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Badge color="gray" size="lg">Not Connected</Badge>
        )}
      </Flex>

      {/* Current Status */}
      {isConfigured && (
        <div className="mb-6 p-4 bg-emerald-50 rounded-lg">
          <Text className="font-medium text-emerald-800 mb-2">Stripe Data Synced</Text>
          <Flex justifyContent="start" className="gap-4">
            <Badge color="blue">{plansCount} Plans</Badge>
            <Badge color="violet">{pricesCount} Prices</Badge>
            <Badge color="emerald">{activeSubscriptions} Active Subscriptions</Badge>
          </Flex>
        </div>
      )}

      {/* Messages */}
      {message && (
        <Callout
          title={message.type === 'success' ? 'Success' : 'Error'}
          color={message.type === 'success' ? 'emerald' : 'rose'}
          icon={message.type === 'success' ? CheckCircle : AlertTriangle}
          className="mb-4"
        >
          {message.text}
        </Callout>
      )}

      {/* Configuration Form */}
      {!isConfigured && (
        <div className="space-y-4 mb-6">
          <div>
            <Flex justifyContent="start" alignItems="center" className="gap-2 mb-1">
              <Key className="w-4 h-4 text-gray-500" />
              <Text className="font-medium">Stripe Secret Key</Text>
            </Flex>
            <TextInput
              placeholder="sk_live_... or sk_test_..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              type="password"
            />
            <Text className="text-xs text-gray-500 mt-1">
              Find this in Stripe Dashboard → Developers → API Keys
            </Text>
          </div>

          <div>
            <Flex justifyContent="start" alignItems="center" className="gap-2 mb-1">
              <Webhook className="w-4 h-4 text-gray-500" />
              <Text className="font-medium">Webhook Secret (Optional)</Text>
            </Flex>
            <TextInput
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              type="password"
            />
            <Text className="text-xs text-gray-500 mt-1">
              For real-time subscription updates. Create webhook pointing to your /api/webhooks/stripe endpoint.
            </Text>
          </div>

          <Button
            onClick={handleSaveKeys}
            loading={saving}
            disabled={!secretKey}
            color="blue"
          >
            Save Stripe Keys
          </Button>
        </div>
      )}

      {/* Sync Button */}
      {isConfigured && (
        <div className="border-t pt-4">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text className="font-medium">Sync from Stripe</Text>
              <Text className="text-sm text-gray-500">
                Pull latest products, prices, and subscriptions
              </Text>
            </div>
            <Button
              onClick={handleSync}
              loading={syncing}
              icon={RefreshCw}
              variant="secondary"
            >
              Sync Now
            </Button>
          </Flex>
        </div>
      )}

      {/* Update Keys (when already configured) */}
      {isConfigured && (
        <div className="border-t pt-4 mt-4">
          <Text className="font-medium mb-2">Update Stripe Keys</Text>
          <div className="space-y-3">
            <TextInput
              placeholder="New secret key (sk_live_... or sk_test_...)"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              type="password"
            />
            <TextInput
              placeholder="New webhook secret (whsec_...)"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              type="password"
            />
            <Button
              onClick={handleSaveKeys}
              loading={saving}
              disabled={!secretKey}
              variant="secondary"
              size="sm"
            >
              Update Keys
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
