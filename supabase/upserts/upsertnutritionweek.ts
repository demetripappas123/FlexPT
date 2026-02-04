import { supabase } from '@/supabase/supabaseClient'
import { NutritionWeek } from '@/supabase/fetches/fetchnutritionweeks'

export type NutritionWeekInput = {
  id?: string // uuid
  program_id: string
  week_number: number
}

export async function upsertNutritionWeek(week: NutritionWeekInput): Promise<NutritionWeek | null> {
  try {
    const weekData = {
      program_id: week.program_id,
      week_number: week.week_number,
      updated_at: new Date().toISOString(),
    }

    if (week.id) {
      // Update existing week
      const { data, error } = await supabase
        .from('nutrition_weeks')
        .update(weekData)
        .eq('id', week.id)
        .select()
        .single()

      if (error) throw error
      return {
        id: data.id,
        program_id: data.program_id,
        week_number: data.week_number,
        created_at: data.created_at,
        updated_at: data.updated_at,
        days: [],
      }
    } else {
      // Insert new week
      const { data, error } = await supabase
        .from('nutrition_weeks')
        .insert([weekData])
        .select()
        .single()

      if (error) throw error
      return {
        id: data.id,
        program_id: data.program_id,
        week_number: data.week_number,
        created_at: data.created_at,
        updated_at: data.updated_at,
        days: [],
      }
    }
  } catch (err) {
    console.error('Error upserting nutrition week:', err)
    return null
  }
}

export async function deleteNutritionWeek(weekId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nutrition_weeks')
      .delete()
      .eq('id', weekId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting nutrition week:', err)
    return false
  }
}
