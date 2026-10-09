import { supabase } from '../supabaseClient'
import { Workout } from './fetchworkouts'
import { SessionExerciseWithName } from './fetchsessions'

export interface WorkoutWithExercises extends Workout {
  exercises?: Array<SessionExerciseWithName & {
    sets?: Array<{
      id: string
      session_exercise_id: string
      set_number: number
      weight: string | null
      reps: string | null
      rir: string | null
      rpe: string | null
      notes: string | null
    }>
  }>
}

/**
 * Fetch workouts with their exercises and sets for the workout library
 * Filters by trainer_id
 */
export async function fetchWorkoutsWithData(trainerId: string): Promise<WorkoutWithExercises[]> {
  // Step 1: Fetch all workouts for this trainer
  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })

  if (workoutsError) {
    console.error('Error fetching workouts:', workoutsError)
    throw workoutsError
  }

  if (!workouts || workouts.length === 0) {
    return []
  }

  const workoutIds = workouts.map(w => w.id)

  // Step 2: Fetch all exercises for these workouts
  const { data: exercises, error: exercisesError } = await supabase
    .from('workout_exercises')
    .select(`
      *,
      exercises:exercise_id (
        id,
        name
      )
    `)
    .in('workout_id', workoutIds)
    .order('position', { ascending: true })

  if (exercisesError) {
    console.error('Error fetching exercises:', exercisesError)
    // Continue without exercises
  }

  // Create a map of workout_id -> exercises
  const exercisesMap = new Map<string, typeof exercises>()
  if (exercises) {
    exercises.forEach(exercise => {
      const workoutId = exercise.workout_id
      if (!exercisesMap.has(workoutId)) {
        exercisesMap.set(workoutId, [])
      }
      exercisesMap.get(workoutId)!.push(exercise)
    })
  }

  // Step 3: Fetch all sets for these exercises
  const exerciseIds = exercises?.map(e => e.id) || []
  let setsMap = new Map<string, any[]>()

  if (exerciseIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('exercise_sets')
      .select('*')
      .in('session_exercise_id', exerciseIds)
      .order('set_number', { ascending: true })

    if (setsError) {
      console.error('Error fetching sets:', setsError)
      // Continue without sets
    } else if (sets) {
      sets.forEach(set => {
        const exerciseId = set.session_exercise_id
        if (!setsMap.has(exerciseId)) {
          setsMap.set(exerciseId, [])
        }
        setsMap.get(exerciseId)!.push(set)
      })
    }
  }

  // Step 4: Combine all data
  return workouts.map(workout => {
    const workoutExercises = exercisesMap.get(workout.id) || []
    const exercisesWithSets = workoutExercises.map(exercise => ({
      ...exercise,
      exercise_name: (exercise.exercises as any)?.name,
      sets: setsMap.get(exercise.id) || [],
    }))

    return {
      ...workout,
      exercises: exercisesWithSets,
    }
  })
}


