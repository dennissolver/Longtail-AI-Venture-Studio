import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// POST /api/track - Receive tracking events from venture apps
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      venture,      // venture slug (required)
      event,        // event type: signup, subscription, payment, churn (required)
      email,        // customer email (required for most events)
      name,         // customer name (optional)
      plan,         // plan name: free, starter, pro, enterprise (optional)
      amount,       // payment amount in dollars (optional)
      currency,     // currency code (optional, defaults to USD)
      status,       // status: trial, active, churned, canceled (optional)
      source,       // signup source (optional)
      metadata,     // additional data (optional)
    } = body

    // Validate required fields
    if (!venture) {
      return NextResponse.json({ error: 'Missing venture slug' }, { status: 400 })
    }
    if (!event) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
    }

    const supabase = await createSupabaseServer()

    // Get venture by slug
    const { data: ventureData, error: ventureError } = await supabase
      .from('ventures')
      .select('id')
      .eq('slug', venture)
      .single()

    if (ventureError || !ventureData) {
      return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const ventureId = ventureData.id

    // Handle different event types
    switch (event) {
      case 'signup': {
        if (!email) {
          return NextResponse.json({ error: 'Email required for signup' }, { status: 400 })
        }

        // Check if signup already exists
        const { data: existing } = await supabase
          .from('signups')
          .select('id')
          .eq('venture_id', ventureId)
          .eq('email', email)
          .single()

        if (existing) {
          // Update existing signup
          await supabase
            .from('signups')
            .update({
              name: name || null,
              plan: plan || 'free',
              status: status || 'active',
              source: source || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          // Create new signup
          await supabase.from('signups').insert({
            venture_id: ventureId,
            email,
            name: name || null,
            plan: plan || 'free',
            status: status || 'active',
            source: source || null,
          })
        }

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'signup',
          email,
          data: { plan, source, ...metadata },
        })

        break
      }

      case 'subscription': {
        if (!email) {
          return NextResponse.json({ error: 'Email required for subscription' }, { status: 400 })
        }

        // Update signup to paid plan
        await supabase
          .from('signups')
          .update({
            plan: plan || 'paid',
            status: status || 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('venture_id', ventureId)
          .eq('email', email)

        // Log revenue if amount provided
        if (amount && amount > 0) {
          await supabase.from('revenue').insert({
            venture_id: ventureId,
            amount,
            currency: currency || 'USD',
            type: 'subscription',
            email,
          })
        }

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'subscription',
          email,
          data: { plan, amount, status, ...metadata },
        })

        break
      }

      case 'payment': {
        if (!amount) {
          return NextResponse.json({ error: 'Amount required for payment' }, { status: 400 })
        }

        // Log revenue
        await supabase.from('revenue').insert({
          venture_id: ventureId,
          amount,
          currency: currency || 'USD',
          type: 'payment',
          email: email || null,
        })

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'payment',
          email: email || null,
          data: { amount, currency, ...metadata },
        })

        break
      }

      case 'churn': {
        if (!email) {
          return NextResponse.json({ error: 'Email required for churn' }, { status: 400 })
        }

        // Update signup status to churned
        await supabase
          .from('signups')
          .update({
            status: 'churned',
            updated_at: new Date().toISOString(),
          })
          .eq('venture_id', ventureId)
          .eq('email', email)

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'churn',
          email,
          data: metadata,
        })

        break
      }

      case 'trial_start': {
        if (!email) {
          return NextResponse.json({ error: 'Email required for trial' }, { status: 400 })
        }

        // Update signup status to trial
        await supabase
          .from('signups')
          .update({
            plan: plan || 'trial',
            status: 'trial',
            updated_at: new Date().toISOString(),
          })
          .eq('venture_id', ventureId)
          .eq('email', email)

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'trial_start',
          email,
          data: { plan, ...metadata },
        })

        break
      }

      case 'trial_end': {
        if (!email) {
          return NextResponse.json({ error: 'Email required for trial end' }, { status: 400 })
        }

        // Update based on whether they converted
        const newStatus = status === 'active' ? 'active' : 'churned'
        await supabase
          .from('signups')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('venture_id', ventureId)
          .eq('email', email)

        // Log event
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: 'trial_end',
          email,
          data: { converted: status === 'active', ...metadata },
        })

        break
      }

      default: {
        // Generic event logging
        await supabase.from('events').insert({
          venture_id: ventureId,
          type: event,
          email: email || null,
          data: { plan, amount, status, source, ...metadata },
        })
      }
    }

    return NextResponse.json({ success: true, event })
  } catch (error: any) {
    console.error('Tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/track - Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Tracking API ready',
    events: ['signup', 'subscription', 'payment', 'churn', 'trial_start', 'trial_end'],
  })
}
