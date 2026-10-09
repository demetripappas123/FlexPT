import { supabase } from '@/supabase/supabaseClient'

export type DayExerciseWithName = {
  day_id: string
  exercise_def_id: string
  exercise_name: string
  sets: string | null // numrange in PostgreSQL format
  reps: string | null // numrange in PostgreSQL format
  rir: string | null // numrange in PostgreSQL format
  rpe: string | null // numrange in PostgreSQL format
  notes: string
  weight_used: string | null // numrange in PostgreSQL format
  exercise_number: number | null
}

export async function fetchDayExercises(dayId: string, trainerId?: string | null): Promise<DayExerciseWithName[]> {
  try {
    // Note: program_exercises don't have trainer_id set, so we don't filter by it
    // Exercises are already filtered by being associated with days that belong to weeks filtered by trainer_id
    const { data, error } = await supabase
      .from('program_exercises')
      .select(`
        day_id,
        exercise_def_id,
        sets,
        reps,
        rir,
        rpe,
        notes,
        weight_used,
        exercise_number,
        exercises:exercise_def_id (
          id,
          name
        )
      `)
      .eq('day_id', dayId)
      .order('exercise_number', { ascending: true, nullsFirst: false })
      .order('exercise_def_id', { ascending: true })

    if (error) {
      console.error('fetchDayExercises error:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return []
    }

    if (!data) return []

    // Map the response to include exercise name
    const exercises: DayExerciseWithName[] = data.map((ex: any) => ({
      day_id: ex.day_id,
      exercise_def_id: ex.exercise_def_id,
      exercise_name: ex.exercises?.name || 'Unknown Exercise',
      sets: ex.sets,
      reps: ex.reps,
      rir: ex.rir,
      rpe: ex.rpe,
      notes: ex.notes || '',
      weight_used: ex.weight_used,
      exercise_number: ex.exercise_number,
    }))

    return exercises
  } catch (err) {
    console.error('fetchDayExercises unexpected error:', err)
    return []
  }
}

