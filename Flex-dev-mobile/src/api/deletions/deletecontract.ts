import { supabase } from '../supabase'

/**
 * Delete a contract by ID.
 */
export async function deleteContract(contractId: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)

  if (error) {
    console.error('Error deleting contract:', error)
    throw error
  }
}
