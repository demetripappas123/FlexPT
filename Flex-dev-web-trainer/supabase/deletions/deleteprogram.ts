import { supabase } from '../supabaseClient'

export type Program = {
  id: string       // UUID
  name: string
  description?: string | null
  user_id?: string | null
  weeks?: object | null
  updated_at?: string
}

/**
 * Deletes a program by its ID
 * @param programId UUID of the program to delete
 * @returns deleted program data or null if not found
 */
export async function deleteProgram(programId: string): Promise<Program | null> {
  if (!programId) throw new Error('Program ID is required.')

  const { data, error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId)
    .select() // returns deleted row(s)

  if (error) {
    console.error('Error deleting program:', error)
    throw error
  }

  return data?.[0] ?? null
}
