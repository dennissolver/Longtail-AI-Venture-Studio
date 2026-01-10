import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

// POST /api/track
// Endpoint for ventures to send events
export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.TRACKER_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { project, event, data } = body

    if (!project || !event) {
      return NextResponse.json(
        { error: 'Missing required fields: project, event' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get venture ID from slug
    const { data: venture, error: ventureError } = await supabase
      .from('ventures')
      .select('id')
      .eq('slug', project)
      .single()

    if (ventureError || !venture) {
      return NextResponse.json(
        { error: `Venture not found: ${project}` },
        { status: 404 }
      )
    }

    // Handle different event types
    switch (event) {
      case 'signup':
        await handleSignup(supabase, venture.id, data)
        break
      case 'revenue':
        await handleRevenue(supabase, venture.id, data)
        break
      case 'upgrade':
      case 'downgrade':
        await handlePlanChange(supabase, venture.id, event, data)
        break
      case 'churn':
        await handleChurn(supabase, venture.id, data)
        break
      default:
        // Generic event
        await supabase.from('events').insert({
          venture_id: venture.id,
          type: event,
          email: data?.email,
          data,
        })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Track API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleSignup(supabase: any, ventureId: string, data: any) {
  const { email, name, company, plan = 'free', source, metadata } = data

  // Insert signup
  await supabase.from('signups').insert({
    venture_id: ventureId,
    email,
    name,
    company,
    plan,
    status: plan === 'free' ? 'trial' : 'active',
    source,
    metadata,
  })

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'signup',
    email,
    data: { plan, source },
  })
}

async function handleRevenue(supabase: any, ventureId: string, data: any) {
  const {
    email,
    amount,
    currency = 'AUD',
    type = 'subscription',
    plan,
    stripe_payment_id,
    stripe_subscription_id,
    period_start,
    period_end,
  } = data

  // Find signup by email
  const { data: signup } = await supabase
    .from('signups')
    .select('id')
    .eq('venture_id', ventureId)
    .eq('email', email)
    .single()

  // Insert revenue
  await supabase.from('revenue').insert({
    venture_id: ventureId,
    signup_id: signup?.id,
    amount,
    currency,
    type,
    plan,
    stripe_payment_id,
    stripe_subscription_id,
    period_start,
    period_end,
  })

  // Update signup status if needed
  if (signup && type !== 'refund') {
    await supabase
      .from('signups')
      .update({ status: 'active', plan: plan || undefined })
      .eq('id', signup.id)
  }

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: type === 'refund' ? 'refund' : 'payment',
    email,
    data: { amount, currency, type, plan },
  })
}

async function handlePlanChange(supabase: any, ventureId: string, event: string, data: any) {
  const { email, from_plan, to_plan, amount } = data

  // Update signup
  await supabase
    .from('signups')
    .update({ plan: to_plan })
    .eq('venture_id', ventureId)
    .eq('email', email)

  // If upgrade includes payment, record revenue
  if (amount && amount > 0) {
    const { data: signup } = await supabase
      .from('signups')
      .select('id')
      .eq('venture_id', ventureId)
      .eq('email', email)
      .single()

    await supabase.from('revenue').insert({
      venture_id: ventureId,
      signup_id: signup?.id,
      amount,
      type: event,
      plan: to_plan,
    })
  }

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: event,
    email,
    data: { from_plan, to_plan, amount },
  })
}

async function handleChurn(supabase: any, ventureId: string, data: any) {
  const { email, reason } = data

  // Update signup status
  await supabase
    .from('signups')
    .update({ status: 'churned' })
    .eq('venture_id', ventureId)
    .eq('email', email)

  // Log event
  await supabase.from('events').insert({
    venture_id: ventureId,
    type: 'churn',
    email,
    data: { reason },
  })
}
