import { supabase } from '@/supabase/supabaseClient'

export type MealsOccurancesFood = {
  id: string
  meal_id: string
  food_id: string | null // uuid, references foods.id (eaten)
  food_name: string | null
  amount: number | null
  unit: string | null
  prescribed_food_id?: string | null
  prescribed_food_name?: string | null
  prescribed_amount?: number | null
  prescribed_unit?: string | null
  created_at: string
}

export async function fetchMealsOccurancesFoods(mealIds: string[]): Promise<MealsOccurancesFood[]> {
  try {
    if (mealIds.length === 0) return []

    const { data, error } = await supabase
      .from('meals_foods_instances')
      .select('*')
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching meals instance foods:', error)
      return []
    }

    return (data || []) as MealsOccurancesFood[]
  } catch (err) {
    console.error('Error fetching meals instance foods:', err)
    return []
  }
}
