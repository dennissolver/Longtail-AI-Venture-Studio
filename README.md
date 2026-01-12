# Longtail AI Ventures - Dashboard Integration Files

## Files Included

### Dashboard (LongtailAIVentureStudio)

Copy these files to your `LongtailAIVentureStudio` project:

```
app/
├── dashboard/
│   ├── page.tsx                      → Main dashboard with Stripe metrics
│   └── [slug]/
│       └── page.tsx                  → Venture detail page
├── api/
│   ├── track/
│   │   └── route.ts                  → Receives events from venture apps
│   └── ventures/
│       └── [slug]/
│           └── stripe/
│               ├── route.ts          → Save/delete Stripe keys
│               └── sync/
│                   └── route.ts      → Sync data from Stripe

components/
├── DashboardClient.tsx               → Main dashboard UI
├── VentureCard.tsx                   → Venture card with subscriber targets
├── VentureDetailClient.tsx           → Venture detail UI with pricing tiers
└── StripeConfig.tsx                  → Stripe configuration UI

lib/
└── utils.ts                          → Utility functions (formatCurrency, etc.)
```

### Database Migration

Run `002_stripe_migration.sql` in Supabase SQL Editor.

### Venture Apps (tracking code)

Copy `lib/tracking.ts` to each venture app's `lib/` folder.

---

## Setup Instructions

### Step 1: Run Database Migration

1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `002_stripe_migration.sql`
3. Click "Run"

### Step 2: Update Dashboard Files

Copy all files from this package to your `LongtailAIVentureStudio` project.

### Step 3: Deploy Dashboard

```bash
cd LongtailAIVentureStudio
npm install stripe  # if not already installed
git add .
git commit -m "Add Stripe integration"
git push
```

### Step 4: Connect Ventures to Stripe

For each venture with Stripe configured:

1. Go to `/dashboard/[venture-slug]`
2. Scroll to "Stripe Integration" section
3. Enter Stripe Secret Key (`sk_live_...` or `sk_test_...`)
4. Click "Save Stripe Keys"
5. Click "Sync Now" to pull products/prices/subscriptions

### Step 5: Add Tracking to Venture Apps

For ventures that need tracking code added:

1. Copy `lib/tracking.ts` to the venture's `lib/` folder
2. Update the `VENTURE_SLUG` constant in the file
3. Add to `.env`:
   ```
   VENTURE_STUDIO_URL=https://longtail-ai-ventures.vercel.app
   NEXT_PUBLIC_VENTURE_SLUG=your-venture-slug
   ```
4. Use tracking functions:
   ```typescript
   import { trackSignup, trackSubscription } from '@/lib/tracking'
   
   // On signup
   await trackSignup({ email: user.email, plan: 'free' })
   
   // On subscription
   await trackSubscription({ email: user.email, plan: 'pro', amount: 49 })
   ```

### Step 6: Forward Stripe Webhooks (Optional)

In your venture's Stripe webhook handler, add:

```typescript
import { forwardStripeEvent } from '@/lib/tracking'

// Inside your webhook handler
await forwardStripeEvent(event)
```

---

## Ready Ventures (from audit)

These ventures have Stripe + Tracking + Env configured:
- ✅ Connexions
- ✅ DealFindrs  
- ✅ LaunchReady
- ✅ OutreachReady

Just need to:
1. Add Stripe keys in dashboard
2. Click "Sync"

## Ventures Needing Stripe SDK

```bash
cd TourLingo && npm install stripe @stripe/stripe-js
cd LeadSpark && npm install stripe @stripe/stripe-js
cd universal-interviews && npm install stripe @stripe/stripe-js
```

## Ventures Needing Tracking Code

- Corporate-AI-Solutions - Add `lib/tracking.ts`
- StoryVerse - Add `VENTURE_STUDIO_URL` to `.env`

---

## API Reference

### POST /api/track

Receives events from venture apps.

```json
{
  "venture": "tourlingo",
  "event": "signup|subscription|payment|churn",
  "email": "user@example.com",
  "plan": "free|starter|pro",
  "amount": 49,
  "status": "trial|active|churned"
}
```

### POST /api/ventures/[slug]/stripe

Save Stripe keys.

```json
{
  "stripe_secret_key": "sk_live_...",
  "stripe_webhook_secret": "whsec_..."
}
```

### POST /api/ventures/[slug]/stripe/sync

Pull products, prices, and subscriptions from Stripe.

Returns:
```json
{
  "success": true,
  "plans": 3,
  "prices": 6,
  "subscriptions": 42
}
```
