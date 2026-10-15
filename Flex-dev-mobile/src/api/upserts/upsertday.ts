import { supabase } from '@/src/api/supabase'
import { WorkoutDelivery } from '@/src/api/utils/workoutDelivery'

export type Day = {
  id: string
  week_id: string
  day_number: number
  name: string
  created_at: string
  delivery?: WorkoutDelivery
}

export async function addDay(
  weekId: string,
  name?: string,
  delivery: WorkoutDelivery = 'solo'
): Promise<Day | null> {
  try {
    // Get the current max day_number for this week
    const { data: maxDayData, error: maxError } = await supabase
      .from('program_days')
      .select('day_number')
      .eq('week_id', weekId)
      .order('day_number', { ascending: false })
      .limit(1)
      .maybeSingle()  // safer for empty weeks

    if (maxError) throw maxError

    const nextDayNumber = (maxDayData?.day_number ?? 0) + 1
    const dayName = name ?? `Day ${nextDayNumber}`

    // Insert the new day
    const { data: newDay, error: insertError } = await supabase
      .from('program_days')
      .insert([{ week_id: weekId, day_number: nextDayNumber, name: dayName, delivery }])
      .select('*')
      .single()

    if (insertError) throw insertError

    return newDay as Day
  } catch (err) {
    console.error('addDay error:', err)
    return null
  }
}

export async function updateDay(
  dayId: string,
  name: string,
  delivery?: WorkoutDelivery
): Promise<Day | null> {
  try {
    const updates: { name: string; delivery?: WorkoutDelivery } = { name }
    if (delivery) updates.delivery = delivery
    const { data: updatedDay, error: updateError } = await supabase
      .from('program_days')
      .update(updates)
      .eq('id', dayId)
      .select('*')
      .single()

    if (updateError) throw updateError

    return updatedDay as Day
  } catch (err) {
    console.error('updateDay error:', err)
    return null
  }
}

export async function updateDayDelivery(
  dayId: string,
  delivery: WorkoutDelivery
): Promise<Day | null> {
  try {
    const { data: updatedDay, error: updateError } = await supabase
      .from('program_days')
      .update({ delivery })
      .eq('id', dayId)
      .select('*')
      .single()

    if (updateError) throw updateError

    return updatedDay as Day
  } catch (err) {
    console.error('updateDayDelivery error:', err)
    return null
  }
}