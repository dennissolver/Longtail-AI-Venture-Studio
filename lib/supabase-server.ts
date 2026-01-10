import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie errors in server components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie errors in server components
          }
        },
      },
    }
  )
}

// Check if user is superadmin
export async function isSuperadmin() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  const { data } = await supabase
    .from('superadmins')
    .select('email')
    .eq('email', user.email)
    .single()
  
  return !!data
}

// Get current user
export async function getUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
