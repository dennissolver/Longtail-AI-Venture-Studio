import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  
  // If already logged in, redirect to dashboard
  if (user) {
    // Check if superadmin
    const { data: superadmin } = await supabase
      .from('superadmins')
      .select('email')
      .eq('email', user.email)
      .single()
    
    if (superadmin) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Longtail AI Ventures</h1>
          <p className="text-gray-400 mt-2">Command Centre</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to continue</h2>
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Superadmin access only
        </p>
      </div>
    </div>
  )
}
