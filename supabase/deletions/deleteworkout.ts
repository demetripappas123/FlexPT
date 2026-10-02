import { supabase } from '../supabaseClient'

/**
 * Delete a workout by ID.
 * Cascades to workout_exercises and exercise_sets.
 * If a session pointed at this workout, that session is unlinked (workout_id set to null), not deleted.
 */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)

  if (error) {
    console.error('Error deleting workout:', error)
    throw error
  }
}





