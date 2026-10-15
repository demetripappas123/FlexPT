import { NextRequest, NextResponse } from 'next/server'
import { requireTrainerFromToken } from '@/supabase/auth/link-person-auth'
import { supabaseAdmin } from '@/supabase/supabaseAdmin'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { validatePaymentAmountForContract } from '@/supabase/utils/applyPaymentToPersonPackages'

function errorStatus(err: unknown): number {
  if (typeof err === 'object' && err && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return 500
}

function originFrom(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  if (host) return `${proto}://${host}`
  return req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  try {
    if (!stripeConfigured()) {
      return NextResponse.json(
        {
          error:
            'Stripe is not configured. Add STRIPE_SECRET_KEY to Flex-dev-web-trainer/.env.local (test key from dashboard.stripe.com/apikeys).',
        },
        { status: 503 }
      )
    }

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const trainer = await requireTrainerFromToken(token)

    const body = await req.json()
    const contractId = typeof body.contractId === 'string' ? body.contractId : ''
    if (!contractId) {
      return NextResponse.json({ error: 'contractId is required' }, { status: 400 })
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select(
        'id, name, person_id, trainer_id, package_id, pif, pif_cost, cost_per_bill_cycle, payment_collector, status'
      )
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    if (contract.trainer_id !== trainer.id) {
      return NextResponse.json({ error: 'Not your contract' }, { status: 403 })
    }
    if (contract.payment_collector === 'organization') {
      return NextResponse.json(
        { error: 'Organization-billed contracts use Record payment, not Stripe' },
        { status: 400 }
      )
    }
    if (!contract.person_id) {
      return NextResponse.json({ error: 'Contract has no client' }, { status: 400 })
    }

    const amount = contract.pif ? Number(contract.pif_cost) : Number(contract.cost_per_bill_cycle)
    const validation = validatePaymentAmountForContract(
      amount,
      contract.pif,
      contract.pif_cost,
      contract.cost_per_bill_cycle
    )
    if (!validation.valid || !(amount > 0)) {
      return NextResponse.json(
        { error: validation.error ?? 'This contract has no billable amount' },
        { status: 400 }
      )
    }

    const { data: person, error: personError } = await supabaseAdmin
      .from('people')
      .select('id, name, email, stripe_customer_id')
      .eq('id', contract.person_id)
      .single()

    if (personError || !person) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const stripe = getStripe()
    let customerId = person.stripe_customer_id as string | null
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: person.name ?? undefined,
        email: person.email ?? undefined,
        metadata: { person_id: person.id, trainer_id: trainer.id },
      })
      customerId = customer.id
      const { error: saveCustomerError } = await supabaseAdmin
        .from('people')
        .update({ stripe_customer_id: customerId })
        .eq('id', person.id)
      if (saveCustomerError) throw saveCustomerError
    }

    const origin = originFrom(req)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: contract.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: contract.name || (contract.pif ? 'Pay in full' : 'Training cycle'),
            },
          },
        },
      ],
      metadata: {
        contract_id: contract.id,
        person_id: person.id,
        trainer_id: trainer.id,
      },
      success_url: `${origin}/people/${person.id}?billing=success`,
      cancel_url: `${origin}/people/${person.id}?billing=cancel`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start checkout'
    return NextResponse.json({ error: message }, { status: errorStatus(err) })
  }
}
