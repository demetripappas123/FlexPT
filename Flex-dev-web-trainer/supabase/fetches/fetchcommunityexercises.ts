import { supabase } from '@/supabase/supabaseClient'
import { ExerciseLibraryItem } from './fetchexlib'

export type CommunityExercise = ExerciseLibraryItem & {
  trainer_id: string | null
  created_at: string
}

export async function fetchCommunityExercises(): Promise<CommunityExercise[]> {
  try {
    // Fetch from unified exercises table where is_private = false (community exercises)
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('is_private', false)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching community exercises:', error)
      return []
    }

    return (data || []).map(item => ({
      id: item.id,
      name: item.name || '',
      video_url: item.video_url || null,
      gif_url: item.gif_url || null,
      img_url: item.img_url || null,
      variations: item.variations || null,
      created_at: item.created_at || new Date().toISOString(),
      trainer_id: item.trainer_id,
    })) as CommunityExercise[]
  } catch (err) {
    console.error('Error fetching community exercises:', err)
    return []
  }
}

