import { supabase } from '../supabaseClient'

export interface PaymentFormData {
  id?: string
  person_package_id?: string | null
  trainer_id?: string | null
  amount: number
  payment_date: string
  method?: string | null
  notes?: string | null
}

/**
 * Create or update a payment
 */
export async function upsertPayment(payment: PaymentFormData): Promise<any> {
  const data: Record<string, unknown> = {
    amount: payment.amount,
    payment_date: payment.payment_date,
  }

  if (payment.person_package_id !== undefined) {
    data.person_package_id = payment.person_package_id
  }
  if (payment.trainer_id !== undefined) {
    data.trainer_id = payment.trainer_id
  }
  if (payment.method !== undefined && payment.method !== null) {
    data.method = payment.method
  }
  if (payment.notes !== undefined && payment.notes !== null) {
    data.notes = payment.notes
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

    return updated
  }

  const { data: created, error } = await supabase.from('payments').insert([data]).select().single()

  if (error) {
    console.error('Error creating payment:', error)
    throw error
  }

  return created
}
