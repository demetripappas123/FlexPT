import { fetchDayExercises } from '@/src/api/fetches/fetchdayexercises'
import { upsertWorkout, WorkoutFormData } from '@/src/api/upserts/upsertworkout'
import { upsertWorkoutExercises, upsertExerciseSets } from '@/src/api/upserts/upsertsession'
import { formatRangeDisplay } from '@/src/api/utils/rangeparse'
import { workoutTimestamp } from '@/src/api/utils/programDates'
import { WorkoutDelivery } from '@/src/api/utils/workoutDelivery'

function numSetsFromRange(sets: string | null | undefined): number {
  if (!sets) return 3
  const formatted = formatRangeDisplay(sets)
  if (!formatted) return 3
  if (formatted.includes('-')) {
    const upper = parseInt(formatted.split('-')[1]?.trim() || '', 10)
    return Number.isFinite(upper) ? upper : 3
  }
  const num = parseInt(formatted.trim(), 10)
  return Number.isFinite(num) ? num : 3
}

export async function copyProgramDayToWorkout(input: {
  personId: string
  trainerId?: string | null
  dayId: string
  workoutDate: string
  assignmentId?: string | null
  weekNumber?: number | null
  dayName?: string | null
  delivery?: WorkoutDelivery | null
}): Promise<{ id: string }> {
  const dayExercises = await fetchDayExercises(input.dayId, input.trainerId ?? null)
  if (dayExercises.length === 0) {
    throw new Error('Selected day has no exercises')
  }

  const workoutInput: WorkoutFormData = {
    person_id: input.personId,
    day_id: input.dayId,
    completed: false,
    workout_date: workoutTimestamp(input.workoutDate),
    assignment_id: input.assignmentId ?? null,
    week_number: input.weekNumber ?? null,
    day_name: input.dayName ?? null,
    delivery: input.delivery === 'session' ? 'session' : 'solo',
  }

  const workout = await upsertWorkout(workoutInput)

  const createdExercises = await upsertWorkoutExercises(
    workout.id,
    dayExercises.map((ex, index) => ({
      exercise_id: ex.exercise_def_id,
      position: index,
      notes: ex.notes || null,
      prescribed_sets: ex.sets,
      prescribed_reps: ex.reps,
      prescribed_weight: ex.weight_used,
      prescribed_rpe: ex.rpe,
      prescribed_rir: ex.rir,
    }))
  )

  for (let i = 0; i < dayExercises.length; i++) {
    const dayExercise = dayExercises[i]
    const createdExercise = createdExercises[i]
    if (!createdExercise?.id) continue

    const numSets = numSetsFromRange(dayExercise.sets)
    const setData = Array.from({ length: numSets }, (_, index) => ({
      set_number: index + 1,
      weight: null,
      reps: null,
      rir: null,
      rpe: null,
      notes: null,
      completed: false,
    }))

    await upsertExerciseSets(createdExercise.id, setData)
  }

  return { id: workout.id }
}
