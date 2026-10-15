import { supabase } from '../supabaseClient'

export async function startStripeCheckout(contractId: string): Promise<{ url: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not signed in')
  }

  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ contractId }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to start Stripe checkout')
  }
  if (!body.url) {
    throw new Error('Stripe did not return a checkout URL')
  }
  return { url: body.url as string }
}
