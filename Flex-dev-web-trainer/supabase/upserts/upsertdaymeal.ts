import { supabase } from '@/supabase/supabaseClient'
import { DayMeal } from '@/supabase/fetches/fetchnutritionweeks'

export type DayMealInput = {
  id?: string // uuid
  name?: string | null
  description?: string | null
  meal_template_id?: string | null
  nutrition_day?: string | null // uuid, references nutrition_days.id (nullable for standalone meals)
  meal_time?: string | null // time without time zone
  meal_number?: number | null // integer
}

export async function upsertDayMeal(meal: DayMealInput): Promise<DayMeal | null> {
  try {
    // Database columns have spaces - use bracket notation
    const mealData: Record<string, any> = {
      name: meal.name?.trim() || null,
      description: meal.description?.trim() || null,
      meal_template_id: meal.meal_template_id || null,
      nutrition_day: meal.nutrition_day || null, // Allow null for standalone meals
      updated_at: new Date().toISOString(),
    }
    // Column names have spaces in the database
    mealData['meal time'] = meal.meal_time || null
    mealData['meal number'] = meal.meal_number || null

    if (meal.id) {
      // Update existing meal
      const { data, error } = await supabase
        .from('day_meals')
        .update(mealData)
        .eq('id', meal.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating day meal:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.error('Meal data:', JSON.stringify(mealData, null, 2))
        throw error
      }
      return {
        ...data,
        foods: [], // Foods will be fetched separately
      } as DayMeal
    } else {
      // Insert new meal
      const { data, error } = await supabase
        .from('day_meals')
        .insert([mealData])
        .select()
        .single()

      if (error) {
        console.error('Error inserting day meal:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.error('Meal data being sent:', JSON.stringify(mealData, null, 2))
        throw error
      }
      return {
        ...data,
        foods: [], // Foods will be fetched separately
      } as DayMeal
    }
  } catch (err: any) {
    console.error('Error upserting day meal:', err)
    if (err?.message) console.error('Error message:', err.message)
    if (err?.details) console.error('Error details:', err.details)
    if (err?.hint) console.error('Error hint:', err.hint)
    if (err?.code) console.error('Error code:', err.code)
    return null
  }
}

export async function deleteDayMeal(mealId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('day_meals')
      .delete()
      .eq('id', mealId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting day meal:', err)
    return false
  }
}

// Helper function to get next meal number for a day
export async function getNextMealNumber(nutritionDayId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('day_meals')
      .select('"meal number"') // Column name has a space
      .eq('nutrition_day', nutritionDayId)
      .order('"meal number"', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return ((data?.['meal number'] as number) ?? 0) + 1
  } catch (err) {
    console.error('Error getting next meal number:', err)
    return 1
  }
}

