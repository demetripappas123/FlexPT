import { supabase } from '@/supabase/supabaseClient'

export async function deleteDay(dayId: string) {
  try {
    const { error } = await supabase
      .from('program_days')
      .delete()
      .eq('id', dayId)

    if (error) throw error

    return true
  } catch (err) {
    console.error('deleteDay error:', err)
    throw err
  }
}













