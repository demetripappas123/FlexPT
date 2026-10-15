import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { fetchWeeks } from '@/supabase/fetches/fetchweek'
import { fetchNutritionPrograms } from '@/supabase/fetches/fetchnutritionprograms'
import { fetchNutritionWeeks } from '@/supabase/fetches/fetchnutritionweeks'
import { fetchDayMealFoods } from '@/supabase/fetches/fetchdaymealfoods'
import { ProgramAssignment, ProgramGoalKind } from '@/supabase/fetches/fetchprogramassignments'
import { upsertProgramAssignment, upsertProgramGoal } from '@/supabase/upserts/upsertprogramassignment'
import { upsertAssignedMeal } from '@/supabase/upserts/upsertassignedmeal'
import { upsertMealsOccurancesFood } from '@/supabase/upserts/upsertmealsoccurancesfood'
import { assignCheckinForm } from '@/supabase/upserts/upsertcheckinformassignment'
import { copyProgramDayToWorkout } from '@/supabase/utils/copyProgramDayToWorkout'
import { addDays, mondayOf, weekdayOffset } from '@/supabase/utils/programDates'
import { supabase } from '@/supabase/supabaseClient'

export type AssignProgramGoalInput = {
  kind: ProgramGoalKind
  label: string
  notes?: string | null
  baseline_value?: number | null
  target_value?: number | null
  unit?: string | null
}

export type AssignProgramToPersonInput = {
  personId: string
  trainerId: string
  startDate: string
  name?: string
  sourceProgramId?: string | null
  sourceNutritionProgramId?: string | null
  kickoffFormId?: string | null
  checkinFormId?: string | null
  habitFormId?: string | null
  goals?: AssignProgramGoalInput[]
}

export async function assignProgramToPerson(
  input: AssignProgramToPersonInput
): Promise<ProgramAssignment> {
  if (!input.sourceProgramId && !input.sourceNutritionProgramId) {
    throw new Error('Pick a training program, a nutrition program, or both')
  }

  let trainingName: string | null = null
  let nutritionName: string | null = null
  let trainingWeeks = 0
  let nutritionWeeks = 0

  if (input.sourceProgramId) {
    const programs = await fetchPrograms(input.trainerId)
    const program = programs.find((p) => p.id === input.sourceProgramId)
    if (!program) throw new Error('Training program not found')
    trainingName = program.name
  }

  if (input.sourceNutritionProgramId) {
    const programs = await fetchNutritionPrograms(input.trainerId)
    const program = programs.find((p) => p.id === input.sourceNutritionProgramId)
    if (!program) throw new Error('Nutrition program not found')
    nutritionName = program.name
  }

  const name =
    input.name?.trim() ||
    [trainingName, nutritionName].filter(Boolean).join(' + ') ||
    'Program'

  const assignment = await upsertProgramAssignment({
    person_id: input.personId,
    trainer_id: input.trainerId,
    name,
    source_program_id: input.sourceProgramId ?? null,
    source_nutrition_program_id: input.sourceNutritionProgramId ?? null,
    start_date: input.startDate,
    status: 'active',
    kickoff_form_id: input.kickoffFormId ?? null,
    checkin_form_id: input.checkinFormId ?? null,
    habit_form_id: input.habitFormId ?? null,
  })

  if (input.sourceProgramId) {
    const weeks = await fetchWeeks(input.sourceProgramId, input.trainerId)
    trainingWeeks = weeks.length
    for (const week of weeks) {
      const weekNumber = week.number || 1
      for (let i = 0; i < week.days.length; i++) {
        const day = week.days[i]
        const dayNumber = day.day_number && day.day_number > 0 ? day.day_number : i + 1
        const workoutDate = addDays(input.startDate, (weekNumber - 1) * 7 + (dayNumber - 1))
        try {
          await copyProgramDayToWorkout({
            personId: input.personId,
            trainerId: input.trainerId,
            dayId: day.id,
            workoutDate,
            assignmentId: assignment.id,
            weekNumber,
            dayName: day.name,
            delivery: day.delivery === 'session' ? 'session' : 'solo',
          })
        } catch (err) {
          console.warn('Skipping empty program day', day.id, err)
        }
      }
    }
  }

  if (input.sourceNutritionProgramId) {
    const weeks = await fetchNutritionWeeks(input.sourceNutritionProgramId)
    nutritionWeeks = weeks.length
    const week1Monday = mondayOf(input.startDate)
    for (const week of weeks) {
      const weekNumber = week.week_number || 1
      for (const day of week.days) {
        const date = addDays(week1Monday, (weekNumber - 1) * 7 + weekdayOffset(day.day_of_week))
        for (const meal of day.meals) {
          const assignedMeal = await upsertAssignedMeal({
            person_id: input.personId,
            meal_id: meal.id,
            assigned_date: date,
            status: 'pending',
            name: meal.name || 'Meal',
            trainer_id: input.trainerId,
            program_assignment_id: assignment.id,
          })
          if (!assignedMeal) continue
          const foods =
            meal.foods?.length > 0 ? meal.foods : await fetchDayMealFoods([meal.id])
          for (const food of foods) {
            await upsertMealsOccurancesFood({
              meal_id: assignedMeal.id,
              prescribed_food_id: food.food_id,
              prescribed_food_name: food.food_name,
              prescribed_amount: food.amount,
              prescribed_unit: food.unit,
              food_id: null,
              food_name: null,
              amount: null,
              unit: null,
            })
          }
        }
      }
    }
  }

  const weekCount = Math.max(trainingWeeks, nutritionWeeks, 1)
  const weeklyDates = Array.from({ length: weekCount }, (_, i) => addDays(input.startDate, i * 7))

  if (input.kickoffFormId) {
    await assignCheckinForm({
      personId: input.personId,
      trainerId: input.trainerId,
      formId: input.kickoffFormId,
      assignedDate: input.startDate,
      programAssignmentId: assignment.id,
    })
  }

  const weeklyFormIds = [input.checkinFormId, input.habitFormId].filter(
    (id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index && id !== input.kickoffFormId
  )

  for (const formId of weeklyFormIds) {
    for (const date of weeklyDates) {
      if (formId === input.kickoffFormId && date === input.startDate) continue
      await assignCheckinForm({
        personId: input.personId,
        trainerId: input.trainerId,
        formId,
        assignedDate: date,
        programAssignmentId: assignment.id,
      })
    }
  }

  for (const goal of input.goals ?? []) {
    if (!goal.label.trim()) continue
    await upsertProgramGoal({
      assignment_id: assignment.id,
      person_id: input.personId,
      kind: goal.kind,
      label: goal.label,
      notes: goal.notes,
      baseline_value: goal.baseline_value,
      target_value: goal.target_value,
      unit: goal.unit,
    })
  }

  if (input.sourceProgramId) {
    await supabase.from('people').update({ program_id: input.sourceProgramId }).eq('id', input.personId)
  }

  return assignment
}
