export type MacroTotals = {
  calories: number
  protein_grams: number
  carbs_grams: number
  fats_grams: number
}

export const emptyMacros = (): MacroTotals => ({
  calories: 0,
  protein_grams: 0,
  carbs_grams: 0,
  fats_grams: 0,
})

export function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: a.calories + b.calories,
    protein_grams: a.protein_grams + b.protein_grams,
    carbs_grams: a.carbs_grams + b.carbs_grams,
    fats_grams: a.fats_grams + b.fats_grams,
  }
}

export function roundMacros(m: MacroTotals): MacroTotals {
  return {
    calories: Math.round(m.calories),
    protein_grams: Math.round(m.protein_grams),
    carbs_grams: Math.round(m.carbs_grams),
    fats_grams: Math.round(m.fats_grams),
  }
}

export function extraFromDisplayedTotal(
  displayed: number | null | undefined,
  fromMeals: number
): number | null {
  if (displayed == null || Number.isNaN(Number(displayed))) return null
  return Math.round(Number(displayed) - fromMeals)
}

/** USDA nutrient amounts are stored per 100 g. */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  floz: 29.5735,
}

export type FoodServing = {
  food_id: number | null
  serving_size: number | string
  unit_name: string
  description?: string | null
}

export function portionGrams(
  amount: number | null | undefined,
  unit: string | null | undefined,
  servings: FoodServing[],
  foodId: number | null
): number | null {
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null
  const qty = Number(amount)
  const unitId = (unit || 'g').toLowerCase()

  if (GRAMS_PER_UNIT[unitId] != null) {
    return qty * GRAMS_PER_UNIT[unitId]
  }

  const foodServings = servings.filter((s) => s.food_id === foodId)
  const match =
    foodServings.find((s) => (s.unit_name || '').toLowerCase() === unitId) ||
    foodServings.find((s) => (s.description || '').toLowerCase().includes(unitId)) ||
    foodServings.find((s) => (s.unit_name || '').toLowerCase() === 'g' && Number(s.serving_size) > 0)

  if (match) {
    const size = Number(match.serving_size) || 0
    const matchUnit = (match.unit_name || 'g').toLowerCase()
    const sizeGrams = GRAMS_PER_UNIT[matchUnit] != null ? size * GRAMS_PER_UNIT[matchUnit] : size
    return qty * sizeGrams
  }

  // Count units with no serving row: treat one unit as 100 g
  return qty * 100
}
