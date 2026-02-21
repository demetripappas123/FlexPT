import { supabase } from '@/supabase/supabaseClient'
import { CommunityFood } from '@/supabase/fetches/fetchcommunityfoods'

export type CommunityFoodInput = {
  id?: string
  fdc_id?: number | null
  description: string
  food_class?: string | null
  data_type?: string | null
  brand_name?: string | null
  category?: string | null
  created_by?: string | null
}

export async function upsertCommunityFood(food: CommunityFoodInput): Promise<CommunityFood | null> {
  try {
    const foodData = {
      fdc_id: food.fdc_id || null,
      description: food.description.trim(),
      food_class: food.food_class?.trim() || null,
      data_type: food.data_type?.trim() || null,
      brand_name: food.brand_name?.trim() || null,
      category: food.category?.trim() || null,
      trainer_id: food.created_by || null, // Use trainer_id instead of created_by
      is_private: false, // Community foods are public
    }

    if (food.id) {
      // Update existing food
      const { data, error } = await supabase
        .from('foods')
        .update(foodData)
        .eq('id', food.id)
        .select()
        .single()

      if (error) throw error
      return data as CommunityFood
    } else {
      // Insert new food
      const { data, error } = await supabase
        .from('foods')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error
      return data as CommunityFood
    }
  } catch (err) {
    console.error('Error upserting community food:', err)
    return null
  }
}


