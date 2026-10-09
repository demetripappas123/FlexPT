import { supabase } from '../supabaseClient'

export type SessionType = 'Client Session' | 'Prospect Session' | 'Intro Session' | 'Followup Session'
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'canceled_with_charge' | 'canceled_no_charge'

export interface Session {
  id: string
  person_id: string | null
  trainer_id: string | null
  type: SessionType
  workout_id: string | null
  person_package_id: string | null
  start_time: string | null // Scheduled time
  started_at: string | null // Actual time when session started
  end_time: string | null // Actual time when session finished
  created_at: string
  converted: boolean
  status: SessionStatus
}

export interface SessionWithExercises extends Session {
  exercises?: SessionExerciseWithSets[]
}

export interface SessionExercise {
  id: string
  workout_id: string
  exercise_id: string // UUID from exercises
  position: number
  notes: string | null
  created_at: string
}

export interface SessionExerciseWithName extends SessionExercise {
  exercise_name?: string
  sets?: ExerciseSet[]
}

export interface ExerciseSet {
  id: string
  session_exercise_id: string
  set_number: number
  weight: string | null // numrange in PostgreSQL format
  reps: string | null // numrange in PostgreSQL format
  rir: string | null // numrange in PostgreSQL format
  rpe: string | null // numrange in PostgreSQL format
  notes: string | null
  created_at: string
}

export interface SessionExerciseWithSets extends SessionExercise {
  exercise_name?: string
  sets: ExerciseSet[]
}

/**
 * Fetch all sessions
 * Optionally filter by trainer_id
 */
export async function fetchSessions(trainerId?: string | null): Promise<Session[]> {
  let query = supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching sessions:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single session by ID
 */
export async function fetchSessionById(sessionId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching session:', error)
    throw error
  }

  return data
}

/**
 * Fetch sessions for a specific person (client or prospect)
 */
export async function fetchClientSessions(personId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching person sessions:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch session by workout_id (to find which session a workout belongs to)
 */
export async function fetchSessionByWorkoutId(workoutId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching session by workout_id:', error)
    throw error
  }

  return data
}


/**
 * Fetch a session with all exercises and sets
 */
export async function fetchSessionWithExercises(sessionId: string): Promise<SessionWithExercises | null> {
  // Fetch session
  const session = await fetchSessionById(sessionId)
  if (!session) return null
  
  // If no workout_id, return session with empty exercises
  if (!session.workout_id) {
    return { ...session, exercises: [] }
  }

  // Fetch exercises for this workout (workout_exercises references workout_id)
  const { data: exercises, error: exercisesError } = await supabase
    .from('workout_exercises')
    .select(`
      *,
      exercises:exercise_id (
        id,
        name
      )
    `)
    .eq('workout_id', session.workout_id)
    .order('position', { ascending: true })

  // If error, log it but don't throw - return session with empty exercises so the session can still be displayed
  if (exercisesError) {
    console.error('Error fetching session exercises:', exercisesError)
    return { ...session, exercises: [] }
  }

  // If no exercises found, return empty array
  if (!exercises) {
    return { ...session, exercises: [] }
  }

  // Fetch sets for each exercise
  const exercisesWithSets: SessionExerciseWithSets[] = await Promise.all(
    exercises.map(async (exercise) => {
      const { data: sets, error: setsError } = await supabase
        .from('exercise_sets')
        .select('*')
        .eq('session_exercise_id', exercise.id)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching exercise sets:', setsError)
        // Don't throw - return exercise with empty sets
        return {
          ...exercise,
          exercise_name: (exercise.exercises as any)?.name,
          sets: [],
        }
      }

      return {
        ...exercise,
        exercise_name: (exercise.exercises as any)?.name,
        sets: sets ?? [],
      }
    })
  )

  return {
    ...session,
    exercises: exercisesWithSets,
  }
}

/**
 * Fetch exercises for a workout (used by sessions)
 */
export async function fetchWorkoutExercises(workoutId: string): Promise<SessionExerciseWithName[]> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      *,
      exercises:exercise_id (
        id,
        name
      )
    `)
    .eq('workout_id', workoutId)
    .order('position', { ascending: true })

  if (error) {
    console.error('Error fetching workout exercises:', error)
    // Return empty array instead of throwing
    return []
  }

  return (data || []).map((exercise) => ({
    ...exercise,
    exercise_name: (exercise.exercises as any)?.name,
  }))
}

/**
 * Fetch exercises for a session (deprecated - use fetchWorkoutExercises with session.workout_id)
 */
export async function fetchSessionExercises(sessionId: string): Promise<SessionExerciseWithName[]> {
  // First get the session to find the workout_id
  const session = await fetchSessionById(sessionId)
  if (!session || !session.workout_id) return []
  
  return fetchWorkoutExercises(session.workout_id)
}

/**
 * Fetch sets for a session exercise
 */
export async function fetchExerciseSets(sessionExerciseId: string): Promise<ExerciseSet[]> {
  const { data, error } = await supabase
    .from('exercise_sets')
    .select('*')
    .eq('session_exercise_id', sessionExerciseId)
    .order('set_number', { ascending: true })

  if (error) {
    console.error('Error fetching exercise sets:', error)
    throw error
  }

  return data ?? []
}

