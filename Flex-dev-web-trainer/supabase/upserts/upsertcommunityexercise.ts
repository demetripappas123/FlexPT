import { supabase } from '@/supabase/supabaseClient'
import { CommunityExercise } from '@/supabase/fetches/fetchcommunityexercises'

export type CommunityExerciseInput = {
  id?: string
  name: string
  video_url?: string | null
  gif_url?: string | null
  img_url?: string | null
  variations?: string[] | null
  created_by?: string | null
}

export async function upsertCommunityExercise(exercise: CommunityExerciseInput): Promise<CommunityExercise | null> {
  try {
    const exerciseData = {
      name: exercise.name.trim(),
      video_url: exercise.video_url?.trim() || null,
      gif_url: exercise.gif_url?.trim() || null,
      img_url: exercise.img_url?.trim() || null,
      variations: exercise.variations || null,
      trainer_id: exercise.created_by || null, // Use trainer_id instead of created_by
      is_private: false, // Community exercises are public
      updated_at: new Date().toISOString(),
    }

    if (exercise.id) {
      // Update existing exercise
      const { data, error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', exercise.id)
        .select()
        .single()

      if (error) throw error
      return data as CommunityExercise
    } else {
      // Insert new exercise
      const { data, error } = await supabase
        .from('exercises')
        .insert([exerciseData])
        .select()
        .single()

      if (error) throw error
      return data as CommunityExercise
    }
  } catch (err) {
    console.error('Error upserting community exercise:', err)
    return null
  }
}


