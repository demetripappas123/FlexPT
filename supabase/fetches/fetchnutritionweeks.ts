'use client'

import { supabase } from '@/supabase/supabaseClient'
import { fetchDayMealFoods, DayMealFood } from './fetchdaymealfoods'

export type DayMeal = {
  id: string // uuid
  name: string | null
  description: string | null
  meal_template_id: string | null
  nutrition_day: string | null // uuid, references nutrition_days.id (nullable for standalone meals)
  meal_time: string | null // time without time zone
  meal_number: number | null // integer
  created_at: string
  updated_at: string
  foods: DayMealFood[] // Foods from meal_foods_programmed table
}

// DayMealFood is imported from fetchdaymealfoods.ts

export type NutritionDay = {
  id: string // uuid
  nutrition_week_id: string // uuid (references nutrition_weeks.id)
  day_of_week: string
  created_at: string
  updated_at: string
  meals: DayMeal[]
}

export type NutritionWeek = {
  id: string // uuid (changed from number based on database schema)
  program_id: string
  week_number: number
  created_at: string
  updated_at: string
  days: NutritionDay[]
}

export async function fetchNutritionWeeks(programId: string): Promise<NutritionWeek[]> {
  try {
    if (!programId) {
      console.error('Invalid programId:', programId)
      return []
    }

    // Fetch weeks first
    const { data: weeksData, error: weeksError } = await supabase
      .from('nutrition_weeks')
      .select('*')
      .eq('program_id', programId)
      .order('week_number', { ascending: true })

    if (weeksError) {
      console.error('fetchNutritionWeeks supabase error (weeks):', weeksError)
      console.error('Error details:', {
        message: weeksError.message,
        details: weeksError.details,
        hint: weeksError.hint,
        code: weeksError.code
      })
      return []
    }

    if (!weeksData || weeksData.length === 0) return []

    // Get all week IDs
    const weekIds = weeksData.map(week => week.id)

    // Fetch all days for these weeks
      // Column name is "day of week" with a space - must quote it
      const { data: daysData, error: daysError } = await supabase
        .from('nutrition_days')
        .select('*')
        .in('nutrition_week_id', weekIds)
        .order('"day of week"', { ascending: true, nullsFirst: false })

    if (daysError) {
      console.error('fetchNutritionWeeks supabase error (days):', daysError)
      // Continue even if days fetch fails
    }

    // Get all day IDs (these are now uuid strings)
    const dayIds = daysData?.map(day => day.id) || []

    // Fetch all meals for these days
    let mealsData: any[] = []
    if (dayIds.length > 0) {
      const { data: meals, error: mealsError } = await supabase
        .from('day_meals')
        .select('*')
        .in('nutrition_day', dayIds)
        .order('"meal number"', { ascending: true, nullsFirst: false }) // Column name has a space

      if (mealsError) {
        console.error('fetchNutritionWeeks supabase error (meals):', mealsError)
      } else {
        mealsData = meals || []
      }
    }

    // Fetch all meal foods for these meals
    const mealIds = mealsData.map(meal => meal.id)
    const mealFoods = mealIds.length > 0 ? await fetchDayMealFoods(mealIds) : []
    
    // Group meal foods by meal_id
    const foodsByMealId = new Map<string, DayMealFood[]>()
    mealFoods.forEach(food => {
      const mealId = food.meal_id
      if (!foodsByMealId.has(mealId)) {
        foodsByMealId.set(mealId, [])
      }
      foodsByMealId.get(mealId)!.push(food)
    })

    // Group meals by nutrition_day (uuid string)
    const mealsByDayId = new Map<string, DayMeal[]>()
    mealsData.forEach(meal => {
      const dayId = String(meal.nutrition_day) // Ensure it's a string
      if (!mealsByDayId.has(dayId)) {
        mealsByDayId.set(dayId, [])
      }
      mealsByDayId.get(dayId)!.push({
        id: meal.id,
        name: meal.name,
        description: meal.description || null,
        meal_template_id: meal.meal_template_id,
        nutrition_day: meal.nutrition_day,
        meal_time: meal['meal time'] || null, // Column name has a space
        meal_number: meal['meal number'] || null, // Column name has a space
        created_at: meal.created_at,
        updated_at: meal.updated_at,
        foods: foodsByMealId.get(meal.id) || [],
      })
    })

    // Group days by nutrition_week_id
    const daysByWeekId = new Map<string, NutritionDay[]>()
    if (daysData) {
      daysData.forEach(day => {
        const weekId = String(day.nutrition_week_id) // Convert to string for UUID
        const dayId = String(day.id) // Convert to string for UUID
        if (!daysByWeekId.has(weekId)) {
          daysByWeekId.set(weekId, [])
        }
        // Enum value from DB is lowercase, but we normalize to capitalized for display
        const dayValue = day['day of week'] || day.day_of_week || ''
        const capitalizedDay = dayValue.charAt(0).toUpperCase() + dayValue.slice(1).toLowerCase()
        
        daysByWeekId.get(weekId)!.push({
          id: dayId,
          nutrition_week_id: weekId,
          day_of_week: capitalizedDay, // Normalize to capitalized for TypeScript types
          created_at: day.created_at,
          updated_at: day.updated_at,
          meals: mealsByDayId.get(dayId) || [],
        })
      })
    }

    // Map Supabase response to NutritionWeek[] type
    const weeks: NutritionWeek[] = weeksData.map(week => {
      const weekId = String(week.id) // Ensure string for UUID matching
      return {
        id: weekId,
        program_id: week.program_id,
        week_number: week.week_number,
        created_at: week.created_at,
        updated_at: week.updated_at,
        days: daysByWeekId.get(weekId) ?? [],
      }
    })

    return weeks
  } catch (err) {
    console.error('fetchNutritionWeeks unexpected error:', err)
    return []
  }
}
