import { supabase } from '@/supabase/supabaseClient'
import { MealsTemplatesFood } from '@/supabase/fetches/fetchmealstemplatesfoods'

export type MealsTemplatesFoodInput = {
  id?: string // uuid
  meal_id: string // uuid, references meals_templates.id
  food_id: number | null // integer, references foods.id
  food_name: string | null
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
}

export async function upsertMealsTemplatesFood(food: MealsTemplatesFoodInput): Promise<MealsTemplatesFood | null> {
  try {
    const foodData = {
      meal_id: food.meal_id,
      food_id: food.food_id || null,
      food_name: food.food_name?.trim() || null,
      amount: food.amount !== null && food.amount !== undefined ? Number(food.amount) : null, // int4 field in schema
      unit: food.unit || null, // text field
      // Note: meals_foods_templates does NOT have updated_at column
    }

    if (food.id) {
      // Update existing food
      const { data, error } = await supabase
        .from('meals_foods_templates')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) throw error
      return data as MealsTemplatesFood
    } else {
      // Insert new food
      const { data, error } = await supabase
        .from('meals_foods_templates')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error
      return data as MealsTemplatesFood
    }
  } catch (err) {
    console.error('Error upserting meals templates food:', err)
    return null
  }
}

export async function deleteMealsTemplatesFood(foodId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meals_foods_templates')
      .delete()
      .eq('id', foodId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting meals templates food:', err)
    return false
  }
}

