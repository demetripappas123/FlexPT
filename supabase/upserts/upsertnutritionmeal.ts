import { supabase } from '@/supabase/supabaseClient'
import { NutritionMeal, MealFood } from '@/supabase/fetches/fetchnutritionweeks'

export type NutritionMealInput = {
  day_id: string
  meal_name: string
  meal_number?: number | null
  notes?: string | null
}

export async function addNutritionMeal(meal: NutritionMealInput): Promise<NutritionMeal | null> {
  try {
    // Get the current max meal_number for this day
    const { data: maxMealData, error: maxError } = await supabase
      .from('nutrition_meals')
      .select('meal_number')
      .eq('day_id', meal.day_id)
      .order('meal_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxError) throw maxError

    const nextMealNumber = meal.meal_number ?? ((maxMealData?.meal_number ?? 0) + 1)

    // Insert the new meal
    const { data: newMeal, error: insertError } = await supabase
      .from('nutrition_meals')
      .insert([{
        day_id: meal.day_id,
        meal_name: meal.meal_name,
        meal_number: nextMealNumber,
        notes: meal.notes || null,
      }])
      .select('*')
      .single()

    if (insertError) throw insertError

    return {
      id: newMeal.id,
      day_id: newMeal.day_id,
      meal_name: newMeal.meal_name,
      meal_number: newMeal.meal_number,
      notes: newMeal.notes,
      foods: [],
    }
  } catch (err) {
    console.error('addNutritionMeal error:', err)
    return null
  }
}

export async function updateNutritionMeal(mealId: string, updates: Partial<NutritionMealInput>): Promise<NutritionMeal | null> {
  try {
    const { data, error } = await supabase
      .from('nutrition_meals')
      .update(updates)
      .eq('id', mealId)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      day_id: data.day_id,
      meal_name: data.meal_name,
      meal_number: data.meal_number,
      notes: data.notes,
      foods: [],
    }
  } catch (err) {
    console.error('updateNutritionMeal error:', err)
    return null
  }
}

export async function deleteNutritionMeal(mealId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nutrition_meals')
      .delete()
      .eq('id', mealId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('deleteNutritionMeal error:', err)
    return false
  }
}

export type MealFoodInput = {
  meal_id: string
  food_id: string
  quantity?: number | null
  unit?: string | null
  notes?: string | null
}

export async function upsertMealFood(food: MealFoodInput & { id?: string }): Promise<MealFood | null> {
  try {
    const foodData = {
      meal_id: food.meal_id,
      food_id: food.food_id,
      quantity: food.quantity ?? null,
      unit: food.unit ?? null,
      notes: food.notes ?? null,
    }

    if (food.id) {
      // Update existing meal food
      const { data, error } = await supabase
        .from('meal_foods')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) throw error
      return data as MealFood
    } else {
      // Insert new meal food
      const { data, error } = await supabase
        .from('meal_foods')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error
      return data as MealFood
    }
  } catch (err) {
    console.error('upsertMealFood error:', err)
    return null
  }
}

export async function deleteMealFood(foodId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meal_foods')
      .delete()
      .eq('id', foodId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('deleteMealFood error:', err)
    return false
  }
}


