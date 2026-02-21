import { supabase } from '@/supabase/supabaseClient'

export async function deleteUserFood(foodId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('foods')
      .delete()
      .eq('id', foodId)
      .eq('trainer_id', userId)
      .eq('is_private', true) // Ensure it's a private food

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting user food:', err)
    return false
  }
}


