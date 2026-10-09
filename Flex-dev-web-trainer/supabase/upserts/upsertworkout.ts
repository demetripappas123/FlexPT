import { supabase } from '../supabaseClient'
import { Workout } from '../fetches/fetchworkouts'

export interface WorkoutFormData {
  id?: string
  day_id?: string | null
  person_id: string
  completed?: boolean
  workout_date?: string | null
}

/**
 * Create or update a workout
 */
export async function upsertWorkout(workout: WorkoutFormData): Promise<Workout> {
  const workoutData: any = {
    person_id: workout.person_id,
  }
  
  // Only include optional fields if they have values
  if (workout.day_id !== undefined && workout.day_id !== null) {
    workoutData.day_id = workout.day_id
  }
  
  // Handle completed field (defaults to false if not provided)
  if (workout.completed !== undefined) {
    workoutData.completed = workout.completed
  } else if (!workout.id) {
    // New workouts default to not completed
    workoutData.completed = false
  }
  
  // Handle workout_date field
  if (workout.workout_date !== undefined) {
    workoutData.workout_date = workout.workout_date
  }

  if (workout.id) {
    // Update existing workout
    const { data, error } = await supabase
      .from('workouts')
      .update(workoutData)
      .eq('id', workout.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating workout:', error)
      throw error
    }

    return data
  } else {
    // Create new workout
    const { data, error } = await supabase
      .from('workouts')
      .insert([workoutData])
      .select()
      .single()

    if (error) {
      console.error('Error creating workout:', error)
      throw error
    }

    return data
  }
}

/**
 * Update a workout with partial data (only updates provided fields)
 */
export async function updateWorkout(
  workoutId: string,
  updates: Partial<Omit<WorkoutFormData, 'id' | 'person_id'>>
): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .update(updates)
    .eq('id', workoutId)
    .select()
    .single()

  if (error) {
    console.error('Error updating workout:', error)
    throw error
  }

  return data
}

