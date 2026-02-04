import { supabase } from '@/supabase/supabaseClient'
import { DayMealFood } from '@/supabase/fetches/fetchdaymealfoods'

export type DayMealFoodInput = {
  id?: string // uuid (primary key of meal_foods_programmed)
  meal_id: string // uuid, MUST reference day_meals.id (for program meals, NOT templates or occurrences)
  food_id: string | null // uuid, references foods.id (NOT foods.fdc_id)
  food_name: string | null
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
}

export async function upsertDayMealFood(food: DayMealFoodInput): Promise<DayMealFood | null> {
  try {
    // Ensure amount is a valid integer or null for int4 column
    let amountValue: number | null = null
    if (food.amount !== null && food.amount !== undefined) {
      const numValue = Number(food.amount)
      if (!isNaN(numValue) && isFinite(numValue)) {
        amountValue = Math.floor(numValue) // Ensure it's an integer for int4
      }
    }

    const foodData = {
      meal_id: food.meal_id,
      food_id: food.food_id || null,
      food_name: food.food_name?.trim() || null,
      amount: amountValue, // int4 field in schema
      unit: food.unit || null, // text field
      // Note: meal_foods_programmed table does not have updated_at column
    }

    if (food.id) {
      // Update existing food
      const { data, error } = await supabase
        .from('meal_foods_programmed')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating day meal food:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.error('Food data:', JSON.stringify(foodData, null, 2))
        throw error
      }
      return data as DayMealFood
    } else {
      // Insert new food
      const { data, error } = await supabase
        .from('meal_foods_programmed')
        .insert([foodData])
        .select()
        .single()

      if (error) {
        console.error('Error inserting day meal food:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.error('Food data being sent:', JSON.stringify(foodData, null, 2))
        console.error('Input food:', JSON.stringify(food, null, 2))
        throw error
      }
      return data as DayMealFood
    }
  } catch (err: any) {
    console.error('Error upserting meal food:', err)
    if (err?.message) console.error('Error message:', err.message)
    if (err?.details) console.error('Error details:', err.details)
    if (err?.hint) console.error('Error hint:', err.hint)
    if (err?.code) console.error('Error code:', err.code)
    return null
  }
}

export async function deleteDayMealFood(foodId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meal_foods_programmed')
      .delete()
      .eq('id', foodId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting meal food:', err)
    return false
  }
}

