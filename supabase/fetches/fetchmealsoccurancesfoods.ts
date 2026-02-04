import { supabase } from '@/supabase/supabaseClient'

export type MealsOccurancesFood = {
  id: string // uuid
  meal_id: string // uuid, references meals_occurances.id (NOT day_meals.id or meals_templates.id)
  food_id: number | null // integer, references foods.fdc_id
  food_name: string | null // text
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
  created_at: string
  updated_at: string
}

export async function fetchMealsOccurancesFoods(mealIds: string[]): Promise<MealsOccurancesFood[]> {
  try {
    if (mealIds.length === 0) return []

    const { data, error } = await supabase
      .from('meals_occurances_foods')
      .select('*')
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching meals occurances foods:', error)
      return []
    }

    return (data || []) as MealsOccurancesFood[]
  } catch (err) {
    console.error('Error fetching meals occurances foods:', err)
    return []
  }
}

