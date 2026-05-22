import { supabase } from '../supabaseClient'

export interface PaymentFormData {
  id?: string
  contract_id?: string | null
  trainer_id?: string | null
  amount: number
  currency?: string | null
  status?: string | null
  payment_type?: string | null
  billing_period_start?: string | null
  billing_period_end?: string | null
  external_payment_id?: string | null
  processed_at?: string | null
  generated_obligations?: boolean | null
  failure_reason?: string | null
}

/**
 * Create or update a payment (public.payments schema).
 * trainer_id must match contracts.trainer_id when contract_id is set (DB trigger).
 */
export async function upsertPayment(payment: PaymentFormData): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    amount: payment.amount,
  }

  if (payment.contract_id !== undefined) data.contract_id = payment.contract_id
  if (payment.trainer_id !== undefined) data.trainer_id = payment.trainer_id
  if (payment.currency !== undefined) data.currency = payment.currency
  if (payment.status !== undefined) data.status = payment.status
  if (payment.payment_type !== undefined) data.payment_type = payment.payment_type
  if (payment.billing_period_start !== undefined) {
    data.billing_period_start = payment.billing_period_start
  }
  if (payment.billing_period_end !== undefined) data.billing_period_end = payment.billing_period_end
  if (payment.external_payment_id !== undefined) {
    data.external_payment_id = payment.external_payment_id
  }
  if (payment.processed_at !== undefined) data.processed_at = payment.processed_at
  if (payment.generated_obligations !== undefined) {
    data.generated_obligations = payment.generated_obligations
  }
  if (payment.failure_reason !== undefined) data.failure_reason = payment.failure_reason

  if (payment.id) {
    const { data: updated, error } = await supabase
      .from('payments')
      .update(data)
      .eq('id', payment.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment:', error)
      throw error
    }

    return updated as Record<string, unknown>
  }

  const { data: created, error } = await supabase.from('payments').insert([data]).select().single()

  if (error) {
    console.error('Error creating payment:', error)
    throw error
  }

  return created as Record<string, unknown>
}
