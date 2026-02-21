import { supabase } from '@/supabase/supabaseClient'
import { Food } from './fetchfoods'

export type UserFood = Food & {
  trainer_id: string | null
}

export async function fetchUserFoods(userId?: string | null): Promise<UserFood[]> {
  try {
    if (!userId) {
      return []
    }

    // Fetch from unified foods table where trainer_id matches and is_private = true
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('trainer_id', userId)
      .eq('is_private', true)
      .order('description', { ascending: true })

    if (error) {
      console.error('Error fetching user foods:', error)
      return []
    }

    return (data || []) as UserFood[]
  } catch (err) {
    console.error('Error fetching user foods:', err)
    return []
  }
}


