import { supabase } from '../supabaseClient'
import { fetchPrograms } from './fetchprograms'
import { WorkoutDelivery } from '../utils/workoutDelivery'

export type LibraryWorkout = {
  id: string
  name: string
  delivery: WorkoutDelivery
  dayNumber: number
  weekId: string
  weekNumber: number
  programId: string
  programName: string
  exercises: string[]
}

export async function fetchLibraryWorkouts(trainerId?: string | null): Promise<LibraryWorkout[]> {
  const programs = await fetchPrograms(trainerId)
  const programIds = programs.map((program) => program.id).filter((id): id is string => Boolean(id))
  if (programIds.length === 0) return []

  const programName = new Map(programs.map((program) => [program.id, program.name]))

  const { data: weeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('id, program_id, number')
    .in('program_id', programIds)

  if (weeksError) {
    console.error('Error fetching program weeks for library:', weeksError)
    return []
  }
  if (!weeks || weeks.length === 0) return []

  const weekById = new Map(weeks.map((week) => [week.id as string, week]))
  const { data: days, error: daysError } = await supabase
    .from('program_days')
    .select('id, week_id, day_number, name, delivery')
    .in('week_id', weeks.map((week) => week.id))
    .order('day_number', { ascending: true })

  if (daysError) {
    console.error('Error fetching program days for library:', daysError)
    return []
  }
  if (!days || days.length === 0) return []

  const { data: exercises, error: exercisesError } = await supabase
    .from('program_exercises')
    .select('day_id, exercise_number, exercises:exercise_def_id (name)')
    .in('day_id', days.map((day) => day.id))

  if (exercisesError) {
    console.error('Error fetching program exercises for library:', exercisesError)
  }

  const namesByDay = new Map<string, { number: number; name: string }[]>()
  for (const row of exercises ?? []) {
    const joined = row.exercises as { name?: string } | { name?: string }[] | null
    const name = Array.isArray(joined) ? joined[0]?.name : joined?.name
    if (!name || !row.day_id) continue
    const list = namesByDay.get(row.day_id) ?? []
    list.push({ number: Number(row.exercise_number) || list.length + 1, name })
    namesByDay.set(row.day_id, list)
  }

  return days
    .map((day) => {
      const week = weekById.get(day.week_id)
      if (!week) return null
      const exerciseNames = (namesByDay.get(day.id) ?? [])
        .sort((a, b) => a.number - b.number)
        .map((exercise) => exercise.name)
      return {
        id: day.id as string,
        name: (day.name as string) || `Day ${day.day_number}`,
        delivery: day.delivery === 'session' ? 'session' : 'solo',
        dayNumber: Number(day.day_number) || 0,
        weekId: week.id as string,
        weekNumber: Number(week.number) || 0,
        programId: week.program_id as string,
        programName: programName.get(week.program_id) || 'Program',
        exercises: exerciseNames,
      } satisfies LibraryWorkout
    })
    .filter((workout): workout is LibraryWorkout => workout != null)
    .sort((a, b) =>
      a.programName.localeCompare(b.programName) ||
      a.weekNumber - b.weekNumber ||
      a.dayNumber - b.dayNumber
    )
}
