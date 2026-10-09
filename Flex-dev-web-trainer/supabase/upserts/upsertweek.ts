import { supabase } from '@/supabase/supabaseClient'
import { Week, Day } from '@/supabase/fetches/fetchweek'

export type DayInput = { name: string }

export type WeekInput = {
  program_id: string
  days?: DayInput[] // optional, defaults to Mon-Sun
}

export async function upsertWeek(week: WeekInput): Promise<Week> {
  try {
    // Get the next week number for this program
    const { data: existingWeeks, error: countError } = await supabase
      .from('program_weeks')
      .select('number')
      .eq('program_id', week.program_id)
      .order('number', { ascending: false })
      .limit(1)

    if (countError) throw countError

    // Calculate next week number (1 if no weeks exist, otherwise max + 1)
    const nextNumber = existingWeeks && existingWeeks.length > 0 
      ? (existingWeeks[0].number || 0) + 1 
      : 1

    // Insert the week with the calculated number
    const { data: weekData, error: weekError } = await supabase
      .from('program_weeks')
      .insert([{ program_id: week.program_id, number: nextNumber }])
      .select('*')
      .single()

    if (weekError || !weekData) throw weekError || new Error('Failed to insert week')

    // Return Week type matching fetchWeeks structure with empty days array
    return {
      id: weekData.id,
      program_id: weekData.program_id,
      number: weekData.number,
      days: [] // Empty days array - days are added separately
    }
  } catch (err) {
    console.error('upsertWeek error:', err)
    throw err
  }
}
