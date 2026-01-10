'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { LogOut, Settings, Bell, Zap } from 'lucide-react'

interface DashboardNavProps {
  user: {
    email?: string
  }
}

export default function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Longtail AI Ventures</span>
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-5 h-5" />
            </button>

            {/* Settings */}
            <Link 
              href="/dashboard/settings" 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Settings className="w-5 h-5" />
            </Link>

            {/* User menu */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Superadmin</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
