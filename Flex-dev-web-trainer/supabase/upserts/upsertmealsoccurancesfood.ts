import { supabase } from '@/supabase/supabaseClient'
import { MealsOccurancesFood } from '@/supabase/fetches/fetchmealsoccurancesfoods'

export type MealsOccurancesFoodInput = {
  id?: string
  meal_id: string
  food_id: string | null
  food_name: string | null
  amount: number | null
  unit: string | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function resolveFoodsPk(foodId: string | null): Promise<string | null> {
  if (foodId == null || foodId.trim() === '') return null
  if (isUuid(foodId)) return foodId
  const fdcId = Number(foodId)
  if (!Number.isFinite(fdcId)) return null
  const { data: byFdc } = await supabase.from('foods').select('id').eq('fdc_id', fdcId).maybeSingle()
  return byFdc?.id ?? null
}

export async function upsertMealsOccurancesFood(food: MealsOccurancesFoodInput): Promise<MealsOccurancesFood | null> {
  try {
    const resolvedFoodId = await resolveFoodsPk(food.food_id)
    const foodData = {
      meal_id: food.meal_id,
      food_id: resolvedFoodId,
      food_name: food.food_name?.trim() || null,
      amount: food.amount !== null && food.amount !== undefined ? Number(food.amount) : null,
      unit: food.unit || null,
    }

    if (food.id) {
      const { data, error } = await supabase
        .from('meals_foods_instances')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) throw error
      return data as MealsOccurancesFood
    }

    const { data, error } = await supabase
      .from('meals_foods_instances')
      .insert([foodData])
      .select()
      .single()

    if (error) throw error
    return data as MealsOccurancesFood
  } catch (err) {
    console.error('Error upserting meal instance food:', err)
    return null
  }
}

export async function deleteMealsOccurancesFood(foodId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meals_foods_instances')
      .delete()
      .eq('id', foodId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting meal instance food:', err)
    return false
  }
}
