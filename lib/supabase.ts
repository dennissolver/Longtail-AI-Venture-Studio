import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client (for client components)
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server client with service role (for API routes)
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Types
export interface Venture {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  url: string | null
  github_repo: string | null
  github_url: string | null
  logo_url: string | null
  tech_stack: string[]
  tam: string | null
  status: 'active' | 'paused' | 'exited' | 'archived'
  target_arr: number
  is_public: boolean
  vercel_project_id: string | null
  supabase_project_id: string | null
  stripe_account_id: string | null
  created_at: string
  updated_at: string
}

export interface VentureStats {
  id: string
  name: string
  slug: string
  status: string
  target_arr: number
  total_revenue: number
  total_refunds: number
  mrr: number
  arr: number
  total_signups: number
  paid_customers: number
  churned_customers: number
}

export interface Signup {
  id: string
  venture_id: string
  email: string
  name: string | null
  company: string | null
  plan: 'free' | 'starter' | 'pro' | 'enterprise' | 'custom'
  status: 'trial' | 'active' | 'churned' | 'paused'
  source: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Revenue {
  id: string
  venture_id: string
  signup_id: string | null
  amount: number
  currency: string
  type: 'subscription' | 'one-time' | 'refund' | 'upgrade' | 'downgrade'
  plan: string | null
  period_start: string | null
  period_end: string | null
  stripe_payment_id: string | null
  stripe_subscription_id: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface Event {
  id: string
  venture_id: string
  type: string
  email: string | null
  data: Record<string, any>
  created_at: string
}
