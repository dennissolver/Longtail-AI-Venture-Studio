// app/dashboard/[slug]/settings/page.tsx
import { createSupabaseServer } from '@/lib/supabase-server'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage({
  params
}: {
  params: { slug: string }
}) {
  const supabase = await createSupabaseServer()
  const { slug } = params

  const { data: venture } = await supabase
    .from('ventures')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!venture) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Venture Not Found</h1>
      </div>
    )
  }

  return <SettingsClient venture={venture} />
}