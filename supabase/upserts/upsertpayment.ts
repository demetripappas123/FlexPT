import { supabase } from '../supabaseClient'

export interface PaymentFormData {
  id?: string
  contract_id: string
  trainer_id?: string | null
  amount: number
  currency?: string
  status?: string
  payment_type: string
  external_payment_id?: string | null
  processed_at?: string | null
  generated_obligations?: boolean
  failure_reason?: string | null
  return_payment_or_no?: boolean | null
}

/**
 * Create or update a payment (public.payments schema).
 * trainer_id must match contracts.trainer_id when contract_id is set (DB trigger).
 */
export async function upsertPayment(payment: PaymentFormData): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    contract_id: payment.contract_id,
    amount: payment.amount,
    payment_type: payment.payment_type,
  }

  if (payment.trainer_id !== undefined) data.trainer_id = payment.trainer_id
  if (payment.currency !== undefined) data.currency = payment.currency
  if (payment.status !== undefined) data.status = payment.status
  if (payment.external_payment_id !== undefined) {
    data.external_payment_id = payment.external_payment_id
  }
  if (payment.processed_at !== undefined) data.processed_at = payment.processed_at
  if (payment.generated_obligations !== undefined) {
    data.generated_obligations = payment.generated_obligations
  }
  if (payment.failure_reason !== undefined) data.failure_reason = payment.failure_reason
  if (payment.return_payment_or_no !== undefined) {
    data.return_payment_or_no = payment.return_payment_or_no
  }

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
