import { redirect } from 'next/navigation'
import { createSupabaseServer, isSuperadmin, getUser } from '@/lib/supabase-server'
import DashboardNav from '@/components/DashboardNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  
  if (!user) {
    redirect('/')
  }

  const isAdmin = await isSuperadmin()
  
  if (!isAdmin) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
