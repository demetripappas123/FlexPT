import { supabase } from '@/supabase/supabaseClient'
import { UserFood } from '@/supabase/fetches/fetchuserfoods'

export type UserFoodInput = {
  id?: string
  fdc_id?: number | null
  description: string
  food_class?: string | null
  data_type?: string | null
  brand_name?: string | null
  category?: string | null
  user_id: string
}

export async function upsertUserFood(food: UserFoodInput): Promise<UserFood | null> {
  try {
    const foodData = {
      fdc_id: food.fdc_id || null,
      description: food.description.trim(),
      food_class: food.food_class?.trim() || null,
      data_type: food.data_type?.trim() || null,
      brand_name: food.brand_name?.trim() || null,
      category: food.category?.trim() || null,
      trainer_id: food.user_id, // Use trainer_id instead of user_id
      is_private: true, // Private trainer foods
    }

    if (food.id) {
      // Update existing food
      const { data, error } = await supabase
        .from('foods')
        .update(foodData)
        .eq('id', food.id)
        .eq('trainer_id', food.user_id)
        .select()
        .single()

      if (error) throw error
      return data as UserFood
    } else {
      // Insert new food
      const { data, error } = await supabase
        .from('foods')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error
      return data as UserFood
    }
  } catch (err) {
    console.error('Error upserting user food:', err)
    return null
  }
}


