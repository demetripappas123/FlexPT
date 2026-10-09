import { supabase } from '../supabaseClient'
import { Program } from '../upserts/upsertprogram'

export async function fetchPrograms(trainerId?: string | null): Promise<Program[]> {
  let query = supabase.from('programs').select('*')

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching programs:', error)
    return []
  }

  return (data ?? []) as Program[]
}
