import { supabase } from '@/supabase/supabaseClient'
import { NutritionDay } from '@/supabase/fetches/fetchnutritionweeks'

export type NutritionDayInput = {
  id?: string // uuid
  nutrition_week_id: string // uuid (references nutrition_weeks.id)
  day_of_week: string
}

export async function upsertNutritionDay(day: NutritionDayInput): Promise<NutritionDay | null> {
  try {
    // Database column is "day of week" (with space) - use bracket notation
    // Enum values are lowercase - convert input to lowercase
    const dayData: Record<string, any> = {
      nutrition_week_id: day.nutrition_week_id,
      updated_at: new Date().toISOString(),
    }
    // Column name has a space in the database, enum values must be lowercase (e.g., "monday" not "Monday")
    dayData['day of week'] = day.day_of_week.toLowerCase()

    if (day.id) {
      // Update existing day
      const { data, error } = await supabase
        .from('nutrition_days')
        .update(dayData)
        .eq('id', day.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating nutrition day:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.error('Day data:', JSON.stringify(dayData, null, 2))
        throw error
      }
      
      return {
        id: data.id,
        nutrition_week_id: data.nutrition_week_id,
        day_of_week: data['day of week'] || data.day_of_week || '',
        created_at: data.created_at,
        updated_at: data.updated_at,
        meals: [],
      }
    } else {
      // Insert new day
      const { data: insertData, error: insertError } = await supabase
        .from('nutrition_days')
        .insert([dayData])
        .select('*')
        .single()

      if (insertError) {
        console.error('Error inserting nutrition day:', insertError)
        console.error('Error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        })
        console.error('Day data being sent:', JSON.stringify(dayData, null, 2))
        throw insertError
      }

      return {
        id: insertData.id,
        nutrition_week_id: insertData.nutrition_week_id,
        day_of_week: insertData['day of week'] || insertData.day_of_week || '',
        created_at: insertData.created_at,
        updated_at: insertData.updated_at,
        meals: [],
      }
    }
  } catch (err: any) {
    console.error('Error upserting nutrition day:', err)
    if (err?.message) console.error('Error message:', err.message)
    if (err?.details) console.error('Error details:', err.details)
    if (err?.hint) console.error('Error hint:', err.hint)
    if (err?.code) console.error('Error code:', err.code)
    return null
  }
}

export async function deleteNutritionDay(dayId: string): Promise<boolean> {
  try {
    // STEP 1: Get all day_meals that reference this nutrition_day
    const { data: dayMeals, error: fetchError } = await supabase
      .from('day_meals')
      .select('id')
      .eq('nutrition_day', dayId)

    if (fetchError) {
      console.error('Error fetching day meals for deletion:', fetchError)
      throw fetchError
    }

    // STEP 2: Delete all foods from meal_foods_programmed that reference these day_meals
    if (dayMeals && dayMeals.length > 0) {
      const mealIds = dayMeals.map(meal => meal.id)
      
      const { error: foodsError } = await supabase
        .from('meal_foods_programmed')
        .delete()
        .in('meal_id', mealIds)

      if (foodsError) {
        console.error('Error deleting meal foods:', foodsError)
        throw foodsError
      }

      // STEP 3: Delete all day_meals entries
      const { error: mealsError } = await supabase
        .from('day_meals')
        .delete()
        .eq('nutrition_day', dayId)

      if (mealsError) {
        console.error('Error deleting day meals:', mealsError)
        throw mealsError
      }
    }

    // STEP 4: Finally, delete the nutrition_days entry
    const { error } = await supabase
      .from('nutrition_days')
      .delete()
      .eq('id', dayId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting nutrition day:', err)
    return false
  }
}
