import { supabase } from '@/supabase/supabaseClient'

export type DayMealFood = {
  id: string // uuid (primary key of meal_foods_programmed)
  meal_id: string // uuid, references day_meals.id (NOT meals_templates.id or meals_occurances.id)
  food_id: string | null // uuid, references foods.id (NOT foods.fdc_id)
  food_name: string | null
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
  created_at: string
  // Note: meal_foods_programmed table does not have updated_at column
}

/**
 * Fetch foods for day_meals (program meals)
 * mealIds should be day_meals.id values (UUID strings)
 * Returns foods from meal_foods_programmed table where meal_id references day_meals.id
 */
export async function fetchDayMealFoods(mealIds: string[]): Promise<DayMealFood[]> {
  try {
    if (mealIds.length === 0) return []

    const { data, error } = await supabase
      .from('meal_foods_programmed')
      .select('*')
      .in('meal_id', mealIds) // meal_id references day_meals.id
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching meal foods:', error)
      return []
    }

    return (data || []) as DayMealFood[]
  } catch (err) {
    console.error('Error fetching meal foods:', err)
    return []
  }
}

