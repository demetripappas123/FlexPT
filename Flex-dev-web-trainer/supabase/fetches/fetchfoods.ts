import { supabase } from '@/supabase/supabaseClient'

export type Food = {
  id: string
  fdc_id: number
  description: string
  food_class?: string | null
  data_type?: string | null
  brand_name?: string | null
  category?: string | null
  created_at?: string
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


