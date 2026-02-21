import { supabase } from '@/supabase/supabaseClient'

export type FoodUnit = {
  id: number
  name: string
  created_at?: string
  updated_at?: string
}

export async function fetchFoodUnits(): Promise<FoodUnit[]> {
  try {
    const { data, error } = await supabase
      .from('food_units')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching food units:', error)
      return []
    }

    return (data || []) as FoodUnit[]
  } catch (err) {
    console.error('Error fetching food units:', err)
    return []
  }
}


