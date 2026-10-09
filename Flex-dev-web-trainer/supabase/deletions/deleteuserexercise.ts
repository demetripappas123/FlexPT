import { supabase } from '@/supabase/supabaseClient'

export async function deleteUserExercise(exerciseId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', exerciseId)
      .eq('trainer_id', userId)
      .eq('is_private', true) // Ensure it's a private exercise

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting user exercise:', err)
    return false
  }
}


