import { supabase } from '@/supabase/supabaseClient'

export async function deleteCommunityFood(foodId: string, trainerId?: string | null): Promise<boolean> {
  try {
    let query = supabase
      .from('foods')
      .delete()
      .eq('id', foodId)
      .eq('is_private', false) // Ensure it's a community food

    // If trainerId is provided, only allow deletion if the trainer created it
    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    }

    const { error } = await query

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting community food:', err)
    return false
  }
}


