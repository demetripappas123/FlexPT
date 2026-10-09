import { supabase } from '@/supabase/supabaseClient'
import { UserExercise } from '@/supabase/fetches/fetchuserexercises'

export type UserExerciseInput = {
  id?: string
  name: string
  video_url?: string | null
  gif_url?: string | null
  img_url?: string | null
  variations?: string[] | null
  user_id: string
}

export async function upsertUserExercise(exercise: UserExerciseInput): Promise<UserExercise | null> {
  try {
    const exerciseData = {
      name: exercise.name.trim(),
      video_url: exercise.video_url?.trim() || null,
      gif_url: exercise.gif_url?.trim() || null,
      img_url: exercise.img_url?.trim() || null,
      variations: exercise.variations || null,
      trainer_id: exercise.user_id, // Use trainer_id instead of user_id
      is_private: true, // Private trainer exercises
      updated_at: new Date().toISOString(),
    }

    if (exercise.id) {
      // Update existing exercise
      const { data, error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', exercise.id)
        .eq('trainer_id', exercise.user_id)
        .select()
        .single()

      if (error) throw error
      return data as UserExercise
    } else {
      // Insert new exercise
      const { data, error } = await supabase
        .from('exercises')
        .insert([exerciseData])
        .select()
        .single()

      if (error) throw error
      return data as UserExercise
    }
  } catch (err) {
    console.error('Error upserting user exercise:', err)
    return null
  }
}


