# Longtail AI Ventures — Command Centre

Portfolio dashboard for tracking AI ventures to $1M ARR.

## Features

- 🔐 **Superadmin-only access** — Single login for dennis@corporateaisolutions.com
- 📊 **Portfolio overview** — See all ventures at a glance with key metrics
- 📈 **Drill-down dashboards** — Deep dive into individual venture metrics
- 🔗 **GitHub integration** — Add new ventures from your GitHub repos
- 📡 **Tracking API** — All ventures report signups, revenue, events
- 💰 **Revenue tracking** — MRR, ARR, progress to $1M target

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd longtail-ai-ventures
pnpm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. Copy your project URL and keys from Settings → API

### 3. Configure Environment

```bash
cp .env.example ..env.local
```

Fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GITHUB_TOKEN=ghp_xxx
GITHUB_USERNAME=dennisolevr

TRACKER_API_KEY=your-generated-key
```

### 4. Create Superadmin User

```bash
pnpm db:seed
```

This creates:
- Auth user: `dennis@corporateaisolutions.com` / `longRagamuffin9@`
- Superadmin entry in database
- Sample ventures

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Tracking API

All ventures report to a single endpoint:

```typescript
// In your venture project
await fetch('https://your-dashboard.vercel.app/api/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.TRACKER_API_KEY,
  },
  body: JSON.stringify({
    project: 'tourlingo', // venture slug
    event: 'signup',
    data: {
      email: 'user@example.com',
      plan: 'free',
      source: 'organic',
    },
  }),
})
```

### Supported Events

| Event | Data Fields |
|-------|-------------|
| `signup` | email, name, company, plan, source |
| `revenue` | email, amount, currency, type, plan, stripe_* |
| `upgrade` | email, from_plan, to_plan, amount |
| `downgrade` | email, from_plan, to_plan |
| `churn` | email, reason |
| `*` (custom) | Any JSON data |

## Deploy to Vercel

```bash
vercel
```

Set environment variables in Vercel dashboard.

## Project Structure

```
├── app/
│   ├── page.tsx                 # Login page
│   ├── dashboard/
│   │   ├── page.tsx             # Main dashboard
│   │   └── [slug]/page.tsx      # Venture detail
│   └── api/
│       ├── track/route.ts       # Tracking endpoint
│       └── github/repos/route.ts
├── components/
├── lib/
│   ├── supabase.ts
│   ├── supabase-server.ts
│   └── utils.ts
├── supabase/
│   └── migrations/
└── scripts/
    └── seed.ts
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **UI:** Tailwind CSS + Tremor
- **Charts:** Recharts (via Tremor)
- **Hosting:** Vercel
