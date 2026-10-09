import { supabase } from '@/supabase/supabaseClient'
import { Food } from './fetchfoods'

export type CommunityFood = Food & {
  trainer_id: string | null
}

export async function fetchCommunityFoods(): Promise<CommunityFood[]> {
  try {
    // Fetch from unified foods table where is_private = false (community foods)
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('is_private', false)
      .order('description', { ascending: true })

    if (error) {
      console.error('Error fetching community foods:', error)
      return []
    }

    return (data || []) as CommunityFood[]
  } catch (err) {
    console.error('Error fetching community foods:', err)
    return []
  }
}


