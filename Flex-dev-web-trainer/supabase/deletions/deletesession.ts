import { supabase } from '../supabaseClient'

/**
 * Delete a session by ID
 * Note: This will cascade delete workout_exercises and exercise_sets due to ON DELETE CASCADE
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    console.error('Error deleting session:', error)
    throw error
  }
}

/**
 * Delete a session exercise by ID
 * Note: This will cascade delete exercise_sets due to ON DELETE CASCADE
 */
export async function deleteSessionExercise(sessionExerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('id', sessionExerciseId)

  if (error) {
    console.error('Error deleting session exercise:', error)
    throw error
  }
}

/**
 * Delete all exercises for a workout (used by sessions)
 */
export async function deleteWorkoutExercises(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('workout_id', workoutId)

  if (error) {
    console.error('Error deleting workout exercises:', error)
    throw error
  }
}

/**
 * Delete all exercises for a session (deprecated - use deleteWorkoutExercises)
 */
export async function deleteSessionExercises(sessionId: string): Promise<void> {
  // First get the session to find the workout_id
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('workout_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session?.workout_id) {
    throw new Error('Session not found or has no workout_id')
  }

  return deleteWorkoutExercises(session.workout_id)
}

/**
 * Delete an exercise set by ID
 */
export async function deleteExerciseSet(setId: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_sets')
    .delete()
    .eq('id', setId)

  if (error) {
    console.error('Error deleting exercise set:', error)
    throw error
  }
}

/**
 * Delete all sets for a session exercise
 */
export async function deleteExerciseSets(sessionExerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_sets')
    .delete()
    .eq('session_exercise_id', sessionExerciseId)

  if (error) {
    console.error('Error deleting exercise sets:', error)
    throw error
  }
}

