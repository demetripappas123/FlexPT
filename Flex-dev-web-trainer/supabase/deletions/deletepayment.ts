import { supabase } from '../supabaseClient'

/**
 * Delete a payment by ID
 */
export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)

  if (error) {
    console.error('Error deleting payment:', error)
    throw error
  }
}





