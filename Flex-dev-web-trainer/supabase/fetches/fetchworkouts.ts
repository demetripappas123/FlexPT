import { supabase } from '../supabaseClient'

export interface Workout {
  id: string
  created_at: string
  day_id: string | null
  person_id: string
  completed: boolean
  workout_date: string | null
}

/**
 * Fetch all workouts
 * Optionally filter by trainer_id
 */
export async function fetchWorkouts(trainerId?: string | null): Promise<Workout[]> {
  let query = supabase
    .from('workouts')
    .select('*')
    .order('created_at', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching workouts:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single workout by ID
 */
export async function fetchWorkoutById(workoutId: string): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching workout:', error)
    throw error
  }

  return data
}

/**
 * Fetch workouts for a specific person
 * Only returns completed workouts (for workout history)
 */
export async function fetchPersonWorkouts(personId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('person_id', personId)
    .eq('completed', true) // Only fetch completed workouts for history
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching person workouts:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch workouts for a specific day (from a program)
 */
export async function fetchDayWorkouts(dayId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('day_id', dayId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching day workouts:', error)
    throw error
  }

  return data ?? []
}

