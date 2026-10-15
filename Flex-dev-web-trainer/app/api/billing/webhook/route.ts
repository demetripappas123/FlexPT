import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { recordFlexStripePayment } from '@/supabase/billing/recordFlexStripePayment'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set' },
      { status: 503 }
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const rawBody = await req.text()
  let event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, skipped: 'not_paid' })
  }

  const contractId = session.metadata?.contract_id ?? session.client_reference_id
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  const amountTotal = session.amount_total

  if (!contractId || !paymentIntent || amountTotal == null) {
    return NextResponse.json(
      { error: 'Checkout session missing contract, payment, or amount' },
      { status: 400 }
    )
  }

  try {
    const result = await recordFlexStripePayment({
      contractId,
      amount: amountTotal / 100,
      externalPaymentId: paymentIntent,
      processedAt: new Date().toISOString(),
    })
    return NextResponse.json({ received: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record payment'
    console.error('Stripe webhook record failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
