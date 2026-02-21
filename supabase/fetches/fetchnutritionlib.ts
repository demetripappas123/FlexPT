import { supabase } from '@/supabase/supabaseClient'

export type NutritionLibraryItem = {
  id: string
  name: string
  created_at: string
}

export async function fetchNutritionItems(): Promise<NutritionLibraryItem[]> {
  try {
    const { data, error } = await supabase
      .from('nutrition_library')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data as NutritionLibraryItem[]
  } catch (err) {
    console.error('Error fetching nutrition items:', err)
    return []
  }
}




