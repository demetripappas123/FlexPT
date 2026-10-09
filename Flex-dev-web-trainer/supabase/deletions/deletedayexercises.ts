import { supabase } from '@/supabase/supabaseClient'

/**
 * Deletes exercises for a day.
 * If exerciseDefIds is provided, only deletes those specific exercises.
 * Otherwise, deletes all exercises for the day.
 */
export async function deleteDayExercises(
  dayId: string,
  exerciseDefIds?: string[]
): Promise<boolean> {
  try {
    let query = supabase
      .from('program_exercises')
      .delete()
      .eq('day_id', dayId)

    // If specific exercise IDs provided, only delete those
    if (exerciseDefIds && exerciseDefIds.length > 0) {
      query = query.in('exercise_def_id', exerciseDefIds)
    }

    const { error } = await query

    if (error) {
      console.error('deleteDayExercises error:', error)
      throw error
    }

    return true
  } catch (err) {
    console.error('deleteDayExercises unexpected error:', err)
    return false
  }
}













