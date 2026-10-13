import { supabase } from '@/supabase/supabaseClient'
import { ExerciseLibraryItem } from './fetchexlib'

export type UserExercise = ExerciseLibraryItem & {
  trainer_id: string | null
}

export async function fetchUserExercises(userId?: string | null): Promise<UserExercise[]> {
  try {
    if (!userId) {
      return []
    }

    // Fetch from unified exercises table where trainer_id matches and is_private = true
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('trainer_id', userId)
      .eq('is_private', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching user exercises:', error)
      return []
    }

    return (data || []).map(item => ({
      id: item.id,
      name: item.name || '',
      video_url: item.video_url || null,
      gif_url: item.gif_url || null,
      img_url: item.img_url || null,
      movement_pattern: item.movement_pattern || null,
      variations: item.variations || null,
      pause: item.pause || null,
      tempo: item.tempo || null,
      trainer_id: item.trainer_id ?? null,
      is_private: item.is_private ?? true,
    })) as UserExercise[]
  } catch (err) {
    console.error('Error fetching user exercises:', err)
    return []
  }
}


