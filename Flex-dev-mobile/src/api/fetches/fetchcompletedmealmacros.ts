import { supabase } from '@/src/api/supabase'
import {
  MacroTotals,
  addMacros,
  emptyMacros,
  portionGrams,
  roundMacros,
  FoodServing,
} from '@/src/api/utils/macros'

const ENERGY_KCAL_ID = 1093
const ENERGY_KJ_ID = 1050
const PROTEIN_ID = 1045
const CARB_ID = 1092
const FAT_ID = 1091

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 10)
}

/**
 * Completed meal occurrences for a client, summed by assigned_date.
 * Scaled from food_nutrients (per 100 g) using the occurrence portion.
 */
export async function fetchCompletedMealMacrosByDate(
  personId: string
): Promise<Map<string, MacroTotals>> {
  const totals = new Map<string, MacroTotals>()

  const { data: meals, error: mealsError } = await supabase
    .from('meals_occurances')
    .select('id, assigned_date, status')
    .eq('person_id', personId)
    .eq('status', 'completed')

  if (mealsError) {
    console.error('Error fetching completed meals for macros:', mealsError)
    return totals
  }

  const completed = (meals ?? []).filter((m) => dateKey(m.assigned_date))
  if (completed.length === 0) return totals

  const mealIds = completed.map((m) => m.id)
  const dateByMealId = new Map(completed.map((m) => [m.id, dateKey(m.assigned_date)!]))

  const { data: foods, error: foodsError } = await supabase
    .from('meals_foods_instances')
    .select('id, meal_id, food_id, amount, unit')
    .in('meal_id', mealIds)

  if (foodsError) {
    console.error('Error fetching meal instance foods for macros:', foodsError)
    return totals
  }

  const rows = foods ?? []
  const foodIds = [...new Set(rows.map((r) => r.food_id).filter((id): id is string => id != null))]

  let nutrientByFood = new Map<string, { kcal: number; kj: number; protein: number; carbs: number; fat: number }>()
  let servings: FoodServing[] = []

  if (foodIds.length > 0) {
    const [{ data: nutrients }, { data: servingRows }] = await Promise.all([
      supabase
        .from('food_nutrients')
        .select('food_id, nutrient_id, amount')
        .in('food_id', foodIds)
        .in('nutrient_id', [ENERGY_KCAL_ID, ENERGY_KJ_ID, PROTEIN_ID, CARB_ID, FAT_ID]),
      supabase.from('food_servings').select('food_id, serving_size, unit_name, description').in('food_id', foodIds),
    ])

    servings = (servingRows ?? []) as FoodServing[]

    for (const n of nutrients ?? []) {
      const current = nutrientByFood.get(n.food_id) ?? {
        kcal: 0,
        kj: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
      const amount = Number(n.amount) || 0
      if (n.nutrient_id === ENERGY_KCAL_ID) current.kcal = amount
      if (n.nutrient_id === ENERGY_KJ_ID) current.kj = amount
      if (n.nutrient_id === PROTEIN_ID) current.protein = amount
      if (n.nutrient_id === CARB_ID) current.carbs = amount
      if (n.nutrient_id === FAT_ID) current.fat = amount
      nutrientByFood.set(n.food_id, current)
    }
  }

  for (const row of rows) {
    const date = dateByMealId.get(row.meal_id)
    if (!date || row.food_id == null) continue

    const grams = portionGrams(row.amount, row.unit, servings, row.food_id)
    if (grams == null || grams <= 0) continue

    const per100 = nutrientByFood.get(row.food_id)
    if (!per100) continue

    const factor = grams / 100
    const kcal = per100.kcal > 0 ? per100.kcal : per100.kj / 4.184
    const contrib: MacroTotals = {
      calories: kcal * factor,
      protein_grams: per100.protein * factor,
      carbs_grams: per100.carbs * factor,
      fats_grams: per100.fat * factor,
    }

    totals.set(date, addMacros(totals.get(date) ?? emptyMacros(), contrib))
  }

  for (const [date, macros] of totals) {
    totals.set(date, roundMacros(macros))
  }

  return totals
}
