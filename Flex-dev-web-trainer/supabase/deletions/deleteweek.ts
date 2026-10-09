import { supabase } from '@/supabase/supabaseClient'

export async function deleteWeek(weekId: string) {
  try {
    const { error } = await supabase
      .from('program_weeks')
      .delete()
      .eq('id', weekId)

    if (error) throw error

    return true
  } catch (err) {
    console.error('deleteWeek error:', err)
    throw err
  }
}
