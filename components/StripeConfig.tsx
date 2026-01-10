'use client'

import { useState } from 'react'
import { Card, Title, Text, TextInput, Button, Badge, Callout } from '@tremor/react'
import { Key, RefreshCw, Check, AlertCircle } from 'lucide-react'

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
  activeSubscriptions
}: StripeConfigProps) {
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const saveKeys = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/ventures/${ventureSlug}/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_secret_key: secretKey,
          stripe_webhook_secret: webhookSecret
        })
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Stripe keys saved!' })
        setSecretKey('')
        setWebhookSecret('')
      } else {
        throw new Error('Failed to save')
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save keys' })
    }

    setSaving(false)
  }

  const syncStripe = async () => {
    setSyncing(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/stripe/sync?venture=${ventureSlug}`, { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Synced: ${data.synced.products} products, ${data.synced.prices} prices, ${data.synced.subscriptions} subscriptions`
        })
      } else {
        throw new Error(data.error || 'Sync failed')
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    }

    setSyncing(false)
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-violet-500" />
          <Title>Stripe Integration</Title>
        </div>
        <Badge color={isConfigured ? 'emerald' : 'gray'}>
          {isConfigured ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {isConfigured && (
        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <Text className="text-gray-500">Plans</Text>
            <Text className="text-xl font-semibold">{plansCount}</Text>
          </div>
          <div className="text-center">
            <Text className="text-gray-500">Prices</Text>
            <Text className="text-xl font-semibold">{pricesCount}</Text>
          </div>
          <div className="text-center">
            <Text className="text-gray-500">Active Subs</Text>
            <Text className="text-xl font-semibold text-emerald-600">{activeSubscriptions}</Text>
          </div>
        </div>
      )}

      {message && (
        <Callout
          title={message.type === 'success' ? 'Success' : 'Error'}
          color={message.type === 'success' ? 'emerald' : 'rose'}
          icon={message.type === 'success' ? Check : AlertCircle}
          className="mb-4"
        >
          {message.text}
        </Callout>
      )}

      <div className="space-y-3">
        <div>
          <Text className="text-sm mb-1">Stripe Secret Key</Text>
          <TextInput
            placeholder="sk_live_..."
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            type="password"
          />
        </div>
        <div>
          <Text className="text-sm mb-1">Webhook Secret</Text>
          <TextInput
            placeholder="whsec_..."
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            type="password"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={saveKeys}
            loading={saving}
            disabled={!secretKey}
          >
            Save Keys
          </Button>

          {isConfigured && (
            <Button
              variant="secondary"
              onClick={syncStripe}
              loading={syncing}
              icon={RefreshCw}
            >
              Sync from Stripe
            </Button>
          )}
        </div>
      </div>

      {isConfigured && (
        <div className="mt-4 pt-4 border-t">
          <Text className="text-sm text-gray-500">
            Webhook URL: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/stripe?venture={ventureSlug}
            </code>
          </Text>
        </div>
      )}
    </Card>
  )
}