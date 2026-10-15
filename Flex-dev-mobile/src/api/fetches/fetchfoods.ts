import { supabase } from '@/src/api/supabase'

export type Food = {
  id: string // uuid
  fdc_id: number | null // USDA FDC id, not a FK
  description: string
  food_class?: string | null
  data_type?: string | null
  brand_name?: string | null
  category?: string | null
  default_serving_id?: string | null // uuid, food_servings.id
  trainer_id?: string | null
  is_private?: boolean
  created_at?: string
  updated_at?: string
}

export async function fetchFoods(searchQuery?: string): Promise<Food[]> {
  try {
    // Fetch base foods (where trainer_id is null)
    let query = supabase
      .from('foods')
      .select('*')
      .is('trainer_id', null)
      .order('description', { ascending: true })
      .limit(1000) // Limit to prevent too many results

    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('description', `%${searchQuery.trim()}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return (data ?? []) as Food[]
  } catch (err) {
    console.error('Error fetching foods:', err)
    return []
  }
}


