import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'
import { MacroTotals, emptyMacros } from '@/supabase/utils/macros'

export function entryDateKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function extraFromRow(entry: NutritionEntry): MacroTotals {
  return {
    calories: Number(entry.extra_calories ?? entry.calories ?? 0) || 0,
    protein_grams: Number(entry.extra_protein_grams ?? entry.protein_grams ?? 0) || 0,
    carbs_grams: Number(entry.extra_carbs_grams ?? entry.carbs_grams ?? 0) || 0,
    fats_grams: Number(entry.extra_fats_grams ?? entry.fats_grams ?? 0) || 0,
  }
}

/**
 * Display totals: extra (typed) + completed meal macros for that date.
 * Days that only have completed meals still appear.
 */
export function mergeNutritionDayTotals(
  extras: NutritionEntry[],
  mealMacrosByDate: Map<string, MacroTotals>,
  clientId: string
): NutritionEntry[] {
  const byDate = new Map<string, NutritionEntry>()

  for (const entry of extras) {
    const date = entryDateKey(entry.entry_date)
    if (!date) continue
    byDate.set(date, { ...entry, entry_date: date })
  }

  const dates = new Set<string>([...byDate.keys(), ...mealMacrosByDate.keys()])
  const merged: NutritionEntry[] = []

  for (const date of dates) {
    const extraRow = byDate.get(date)
    const extra = extraRow ? extraFromRow(extraRow) : emptyMacros()
    const fromMeals = mealMacrosByDate.get(date) ?? emptyMacros()
    const hasExtraRow = extraRow != null
    const hasMeals = (mealMacrosByDate.get(date)?.calories ?? 0) > 0
      || (mealMacrosByDate.get(date)?.protein_grams ?? 0) > 0
      || (mealMacrosByDate.get(date)?.carbs_grams ?? 0) > 0
      || (mealMacrosByDate.get(date)?.fats_grams ?? 0) > 0
      || mealMacrosByDate.has(date)

    if (!hasExtraRow && !hasMeals) continue

    merged.push({
      id: extraRow?.id ?? `meals-${date}`,
      client_id: extraRow?.client_id ?? clientId,
      entry_date: date,
      extra_calories: extraRow?.extra_calories ?? extraRow?.calories ?? null,
      extra_protein_grams: extraRow?.extra_protein_grams ?? extraRow?.protein_grams ?? null,
      extra_carbs_grams: extraRow?.extra_carbs_grams ?? extraRow?.carbs_grams ?? null,
      extra_fats_grams: extraRow?.extra_fats_grams ?? extraRow?.fats_grams ?? null,
      calories: extra.calories + fromMeals.calories,
      protein_grams: extra.protein_grams + fromMeals.protein_grams,
      carbs_grams: extra.carbs_grams + fromMeals.carbs_grams,
      fats_grams: extra.fats_grams + fromMeals.fats_grams,
      from_meals: fromMeals,
      created_at: extraRow?.created_at ?? '',
      updated_at: extraRow?.updated_at ?? '',
    })
  }

  return merged.sort((a, b) => b.entry_date.localeCompare(a.entry_date))
}
