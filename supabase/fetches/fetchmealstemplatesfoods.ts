import { supabase } from '@/supabase/supabaseClient'

export type MealsTemplatesFood = {
  id: string // uuid
  meal_id: string // uuid, references meals_templates.id
  food_id: number | null // integer, references foods.fdc_id
  food_name: string | null // text
  amount: number | null // int4 (numeric) in schema
  unit: string | null // text, references food_units.id
  created_at: string // meals_foods_templates does NOT have updated_at
}

export async function fetchMealsTemplatesFoods(mealIds: string[]): Promise<MealsTemplatesFood[]> {
  try {
    if (mealIds.length === 0) return []

    const { data, error } = await supabase
      .from('meals_foods_templates')
      .select('*')
      .in('meal_id', mealIds)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching meals templates foods:', error)
      return []
    }

    return (data || []) as MealsTemplatesFood[]
  } catch (err) {
    console.error('Error fetching meals templates foods:', err)
    return []
  }
}

