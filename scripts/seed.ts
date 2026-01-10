/**
 * Seed script to create the superadmin user
 * Run with: npx tsx scripts/seed.ts
 * 
 * IMPORTANT: Run this once after setting up your Supabase project
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Superadmin credentials
const SUPERADMIN_EMAIL = 'dennis@corporateaisolutions.com'
const SUPERADMIN_PASSWORD = 'longRagamuffin9@'

async function seed() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables')
    console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('🚀 Starting seed...\n')

  // 1. Create auth user
  console.log('Creating superadmin user...')
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    email_confirm: true, // Auto-confirm email
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('✅ Superadmin user already exists')
    } else {
      console.error('❌ Failed to create auth user:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Created auth user:', authUser.user?.email)
  }

  // 2. Ensure superadmin entry exists in superadmins table
  console.log('\nEnsuring superadmin table entry...')
  const { error: superadminError } = await supabase
    .from('superadmins')
    .upsert({ email: SUPERADMIN_EMAIL }, { onConflict: 'email' })

  if (superadminError) {
    console.error('❌ Failed to insert superadmin:', superadminError.message)
  } else {
    console.log('✅ Superadmin entry confirmed')
  }

  // 3. Create sample ventures (optional)
  console.log('\nCreating sample ventures...')
  
  const ventures = [
    {
      name: 'TourLingo',
      slug: 'tourlingo',
      tagline: 'Real-time multilingual translation for tour guides',
      url: 'https://tourlingo.com',
      github_repo: 'dennisolevr/tourlingo-web',
      status: 'active',
      target_arr: 1000000,
    },
    {
      name: 'DealFindrs',
      slug: 'dealfindrs',
      tagline: 'AI-powered deal discovery platform',
      status: 'active',
      target_arr: 1000000,
    },
    {
      name: 'LaunchReady',
      slug: 'launchready',
      tagline: 'Launch toolkit for startups',
      status: 'active',
      target_arr: 1000000,
    },
  ]

  for (const venture of ventures) {
    const { error } = await supabase
      .from('ventures')
      .upsert(venture, { onConflict: 'slug' })
    
    if (error) {
      console.log(`⚠️  Failed to create ${venture.name}:`, error.message)
    } else {
      console.log(`✅ Created/updated venture: ${venture.name}`)
    }
  }

  console.log('\n✨ Seed complete!')
  console.log('\n📝 Login credentials:')
  console.log(`   Email: ${SUPERADMIN_EMAIL}`)
  console.log(`   Password: ${SUPERADMIN_PASSWORD}`)
}

seed().catch(console.error)
