import { supabase } from '@/supabase/supabaseClient'
import { deleteDayExercises } from '@/supabase/deletions/deletedayexercises'

export type DayExercise = {
  day_id: string
  exercise_def_id: string
  sets: string | null // numrange in PostgreSQL format
  reps: string | null // numrange in PostgreSQL format
  rir: string | null // numrange in PostgreSQL format
  rpe: string | null // numrange in PostgreSQL format
  notes: string
  weight_used?: string | null // numrange in PostgreSQL format
  exercise_number?: number | null // Position/order of exercise in the day
}

/**
 * Inserts exercises for a day (for new days).
 * Use updateDayExercises for editing existing days.
 */
export async function upsertDayExercises(
  exercises: DayExercise[]
): Promise<DayExercise[] | null> {
  if (!exercises.length) return null

  try {
    // Map exercises to ensure proper format and handle nulls
    const formattedExercises = exercises.map((ex, index) => ({
      day_id: ex.day_id,
      exercise_def_id: ex.exercise_def_id,
      sets: ex.sets || null, // Convert empty string to null
      reps: ex.reps || null, // Convert empty string to null
      rir: ex.rir || null, // Convert empty string to null
      rpe: ex.rpe || null, // Convert empty string to null
      notes: ex.notes || '',
      weight_used: ex.weight_used ?? null,
      exercise_number: ex.exercise_number ?? index + 1, // Use provided exercise_number or default to index + 1
    }))

    const { data, error } = await supabase
      .from('program_exercises')
      .insert(formattedExercises)
      .select('*')

    if (error) {
      console.error('upsertDayExercises error:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw error
    }
    return data as DayExercise[]
  } catch (err) {
    console.error('upsertDayExercises error:', err)
    return null
  }
}

/**
 * Intelligently updates exercises for a day by:
 * 1. Fetching existing exercises
 * 2. Updating existing exercises that match by exercise_def_id
 * 3. Inserting new exercises that don't exist
 * 4. Deleting exercises that were removed from the list
 * 
 * This preserves exercise data and only modifies what changed.
 */
export async function updateDayExercises(
  dayId: string,
  exercises: DayExercise[]
): Promise<DayExercise[] | null> {
  try {
    // Fetch all existing exercises for this day
    const { data: existingExercises, error: fetchError } = await supabase
      .from('program_exercises')
      .select('*')
      .eq('day_id', dayId)

    if (fetchError) {
      console.error('updateDayExercises fetch error:', fetchError)
      throw fetchError
    }

    // Create a map of existing exercises by exercise_def_id for quick lookup
    const existingMap = new Map<string, any>()
    existingExercises?.forEach(ex => {
      existingMap.set(ex.exercise_def_id, ex)
    })

    // Track which exercise_def_ids should exist after update
    const newExerciseDefIds = new Set(exercises.map(ex => ex.exercise_def_id))

    // Separate exercises into updates and inserts
    const toUpdate: any[] = []
    const toInsert: DayExercise[] = []

    exercises.forEach((ex, index) => {
      const formatted = {
        day_id: ex.day_id,
        exercise_def_id: ex.exercise_def_id,
        sets: ex.sets || null, // Convert empty string to null
        reps: ex.reps || null, // Convert empty string to null
        rir: ex.rir || null, // Convert empty string to null
        rpe: ex.rpe || null, // Convert empty string to null
        notes: ex.notes || '',
        weight_used: ex.weight_used ?? null,
        exercise_number: ex.exercise_number ?? index + 1, // Use provided exercise_number or default to index + 1
      }

      // Check if this exercise already exists
      const existing = existingMap.get(ex.exercise_def_id)
      if (existing) {
        // Update existing exercise - need to find the row by day_id + exercise_def_id
        // Since we don't have a unique constraint, we'll update by both fields
        toUpdate.push(formatted)
      } else {
        // Insert new exercise
        toInsert.push(formatted)
      }
    })

    // Delete exercises that exist in DB but not in the new list
    const toDelete: string[] = []
    existingExercises?.forEach(ex => {
      if (!newExerciseDefIds.has(ex.exercise_def_id)) {
        toDelete.push(ex.exercise_def_id)
      }
    })

    // Perform updates, inserts, and deletes in parallel
    const promises: Promise<any>[] = []

    // Update existing exercises one by one (since no unique constraint)
    toUpdate.forEach(ex => {
      promises.push(
        supabase
          .from('program_exercises')
          .update({
            sets: ex.sets,
            reps: ex.reps,
            rir: ex.rir,
            rpe: ex.rpe,
            notes: ex.notes,
            weight_used: ex.weight_used,
            exercise_number: ex.exercise_number,
          })
          .eq('day_id', dayId)
          .eq('exercise_def_id', ex.exercise_def_id)
          .select('*')
      )
    })

    // Insert new exercises
    if (toInsert.length > 0) {
      promises.push(
        supabase
          .from('program_exercises')
          .insert(toInsert)
          .select('*')
      )
    }

    // Delete removed exercises
    if (toDelete.length > 0) {
      promises.push(deleteDayExercises(dayId, toDelete).then(success => {
        if (!success) throw new Error('Failed to delete exercises')
        return { data: [], error: null }
      }))
    }

    const results = await Promise.all(promises)

    // Check for errors
    for (const result of results) {
      if (result?.error) {
        console.error('updateDayExercises operation error:', result.error)
        throw result.error
      }
    }

    // Fetch and return the updated exercises
    const { data: updatedExercises, error: finalFetchError } = await supabase
      .from('program_exercises')
      .select('*')
      .eq('day_id', dayId)

    if (finalFetchError) {
      console.error('updateDayExercises final fetch error:', finalFetchError)
      throw finalFetchError
    }

    return updatedExercises as DayExercise[]
  } catch (err) {
    console.error('updateDayExercises error:', err)
    return null
  }
}
