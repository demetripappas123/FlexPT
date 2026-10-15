import { supabase } from '@/supabase/supabaseClient'
import { MealsOccurancesFood } from '@/supabase/fetches/fetchmealsoccurancesfoods'

export type MealsOccurancesFoodInput = {
  id?: string
  meal_id: string
  food_id?: string | null
  food_name?: string | null
  amount?: number | null
  unit?: string | null
  prescribed_food_id?: string | null
  prescribed_food_name?: string | null
  prescribed_amount?: number | null
  prescribed_unit?: string | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function resolveFoodsPk(foodId: string | null | undefined): Promise<string | null | undefined> {
  if (foodId === undefined) return undefined
  if (foodId == null || foodId.trim() === '') return null
  if (isUuid(foodId)) return foodId
  const fdcId = Number(foodId)
  if (!Number.isFinite(fdcId)) return null
  const { data: byFdc } = await supabase.from('foods').select('id').eq('fdc_id', fdcId).maybeSingle()
  return byFdc?.id ?? null
}

export async function upsertMealsOccurancesFood(food: MealsOccurancesFoodInput): Promise<MealsOccurancesFood | null> {
  try {
    const foodData: Record<string, unknown> = {
      meal_id: food.meal_id,
    }

    if (food.food_id !== undefined) {
      foodData.food_id = (await resolveFoodsPk(food.food_id)) ?? null
    }
    if (food.food_name !== undefined) foodData.food_name = food.food_name?.trim() || null
    if (food.amount !== undefined) {
      foodData.amount = food.amount !== null ? Number(food.amount) : null
    }
    if (food.unit !== undefined) foodData.unit = food.unit || null

    if (food.prescribed_food_id !== undefined) {
      foodData.prescribed_food_id = (await resolveFoodsPk(food.prescribed_food_id)) ?? null
    }
    if (food.prescribed_food_name !== undefined) {
      foodData.prescribed_food_name = food.prescribed_food_name?.trim() || null
    }
    if (food.prescribed_amount !== undefined) {
      foodData.prescribed_amount = food.prescribed_amount !== null ? Number(food.prescribed_amount) : null
    }
    if (food.prescribed_unit !== undefined) foodData.prescribed_unit = food.prescribed_unit || null

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

export async function fillEatenFromPrescription(mealId: string): Promise<void> {
  const { data: foods, error } = await supabase
    .from('meals_foods_instances')
    .select('*')
    .eq('meal_id', mealId)

  if (error) throw error

  for (const food of foods ?? []) {
    const amount = food.amount ?? food.prescribed_amount ?? null
    const unit = food.unit ?? food.prescribed_unit ?? null
    const foodId = food.food_id ?? food.prescribed_food_id ?? null
    const foodName = food.food_name ?? food.prescribed_food_name ?? null
    if (
      amount === food.amount &&
      unit === food.unit &&
      foodId === food.food_id &&
      foodName === food.food_name
    ) {
      continue
    }
    const { error: updateError } = await supabase
      .from('meals_foods_instances')
      .update({
        amount,
        unit,
        food_id: foodId,
        food_name: foodName,
      })
      .eq('id', food.id)
    if (updateError) throw updateError
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
