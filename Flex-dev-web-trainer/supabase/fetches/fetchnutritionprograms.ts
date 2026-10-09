import { supabase } from '@/supabase/supabaseClient'

export type NutritionProgram = {
  id: string
  trainer_id: string | null
  name: string
  description: string | null
  metadata: object | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export async function fetchNutritionPrograms(trainerId?: string | null): Promise<NutritionProgram[]> {
  try {
    let query = supabase
      .from('nutrition_programs')
      .select('*')

    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    }

    const { data, error } = await query

    if (error) {
      // Log the actual error for debugging
      console.error('Error fetching nutrition programs:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      
      // Only return empty array for actual table-not-found errors
      if (error.code === 'PGRST116' || 
          (error.message && error.message.includes('relation') && error.message.includes('does not exist'))) {
        console.warn('nutrition_programs table does not exist yet')
        return []
      }
      
      // For other errors, throw so we can see what's actually wrong
      throw error
    }

    // Sort by created_at if it exists, otherwise just return data
    const sorted = data ? [...data].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
      return bDate - aDate
    }) : []

    return sorted as NutritionProgram[]
  } catch (err) {
    console.error('Error fetching nutrition programs:', err)
    return []
  }
}

