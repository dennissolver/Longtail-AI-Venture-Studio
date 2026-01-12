import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// POST /api/ventures/[slug]/stripe - Save Stripe keys
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { stripe_secret_key, stripe_webhook_secret } = body

    if (!stripe_secret_key) {
      return NextResponse.json({ error: 'Stripe secret key required' }, { status: 400 })
    }

    if (!stripe_secret_key.startsWith('sk_live_') && !stripe_secret_key.startsWith('sk_test_')) {
      return NextResponse.json({ error: 'Invalid Stripe secret key format' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()

    // Update venture with Stripe keys
    const { data, error } = await supabase
      .from('ventures')
      .update({
        stripe_secret_key,
        stripe_webhook_secret: stripe_webhook_secret || null,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      console.error('Error saving Stripe keys:', error)
      return NextResponse.json({ error: 'Failed to save Stripe keys' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Stripe keys saved' })
  } catch (error: any) {
    console.error('Stripe config error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/ventures/[slug]/stripe - Remove Stripe keys
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createSupabaseServer()

    // Clear Stripe keys
    const { error } = await supabase
      .from('ventures')
      .update({
        stripe_secret_key: null,
        stripe_webhook_secret: null,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug)

    if (error) {
      return NextResponse.json({ error: 'Failed to remove Stripe keys' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Stripe keys removed' })
  } catch (error: any) {
    console.error('Stripe remove error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
