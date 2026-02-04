import { supabase } from '@/supabase/supabaseClient'
import { MealsOccurancesFood } from '@/supabase/fetches/fetchmealsoccurancesfoods'

export type MealsOccurancesFoodInput = {
  id?: string // uuid
  meal_id: string // uuid, references meals_occurances.id (NOT day_meals.id or meals_templates.id)
  food_id: number | null // integer, references foods.fdc_id
  food_name: string | null
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
}

export async function upsertMealsOccurancesFood(food: MealsOccurancesFoodInput): Promise<MealsOccurancesFood | null> {
  try {
    const foodData = {
      meal_id: food.meal_id, // References meals_occurances.id
      food_id: food.food_id || null,
      food_name: food.food_name?.trim() || null,
      amount: food.amount !== null && food.amount !== undefined ? Number(food.amount) : null, // int4 field in schema
      unit: food.unit || null, // text field
      updated_at: new Date().toISOString(),
    }

    if (food.id) {
      // Update existing food
      const { data, error } = await supabase
        .from('meals_occurances_foods')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) throw error
      return data as MealsOccurancesFood
    } else {
      // Insert new food
      const { data, error } = await supabase
        .from('meals_occurances_foods')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error
      return data as MealsOccurancesFood
    }
  } catch (err) {
    console.error('Error upserting meals occurances food:', err)
    return null
  }
}

export async function deleteMealsOccurancesFood(foodId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meals_occurances_foods')
      .delete()
      .eq('id', foodId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting meals occurances food:', err)
    return false
  }
}

