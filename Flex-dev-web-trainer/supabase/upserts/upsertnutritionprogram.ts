import { supabase } from '@/supabase/supabaseClient'
import { NutritionProgram } from '@/supabase/fetches/fetchnutritionprograms'

export type NutritionProgramInput = {
  id?: string
  trainer_id: string
  name: string
  description?: string | null
  metadata?: object | null
  start_date?: string | null
  end_date?: string | null
}

export async function upsertNutritionProgram(program: NutritionProgramInput): Promise<NutritionProgram | null> {
  try {
    const programData = {
      trainer_id: program.trainer_id,
      name: program.name.trim(),
      description: program.description?.trim() || null,
      metadata: program.metadata || null,
      start_date: program.start_date || null,
      end_date: program.end_date || null,
      updated_at: new Date().toISOString(),
    }

    if (program.id) {
      // Update existing program
      const { data, error } = await supabase
        .from('nutrition_programs')
        .update(programData)
        .eq('id', program.id)
        .select()
        .single()

      if (error) throw error
      return data as NutritionProgram
    } else {
      // Insert new program
      const { data, error } = await supabase
        .from('nutrition_programs')
        .insert([programData])
        .select()
        .single()

      if (error) throw error
      return data as NutritionProgram
    }
  } catch (err) {
    console.error('Error upserting nutrition program:', err)
    return null
  }
}

export async function deleteNutritionProgram(programId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nutrition_programs')
      .delete()
      .eq('id', programId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting nutrition program:', err)
    return false
  }
}

