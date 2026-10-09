'use client'

import { supabase } from '@/supabase/supabaseClient'

export type Day = {
  id: string
  name: string
  // Add sessions or workouts later if needed
  sessions?: any[]
}

export type Week = {
  id: string
  program_id: string
  number: number
  days: Day[]
}

export async function fetchWeeks(programId: string, trainerId?: string | null): Promise<Week[]> {
  try {
    // Fetch weeks first
    let weeksQuery = supabase
      .from('program_weeks')
      .select('*')
      .eq('program_id', programId)
      .order('number', { ascending: true })

    if (trainerId) {
      weeksQuery = weeksQuery.eq('trainer_id', trainerId)
    }

    const { data: weeksData, error: weeksError } = await weeksQuery

    if (weeksError) {
      console.error('fetchWeeks supabase error (weeks):', weeksError)
      console.error('Error details:', {
        message: weeksError.message,
        details: weeksError.details,
        hint: weeksError.hint,
        code: weeksError.code
      })
      return [] // return empty array if fetch fails
    }

    if (!weeksData || weeksData.length === 0) return []

    // Get all week IDs
    const weekIds = weeksData.map(week => week.id)

    // Fetch all days for these weeks
    // Note: program_days don't have trainer_id set, so we don't filter by it
    // Days are already filtered by being associated with weeks that are filtered by trainer_id
    const { data: daysData, error: daysError } = await supabase
      .from('program_days')
      .select('*')
      .in('week_id', weekIds)
      .order('day_number', { ascending: true })
    
    console.log('Days query result:', { daysData, daysError, weekIds, weekIdsLength: weekIds.length })

    if (daysError) {
      console.error('fetchWeeks supabase error (days):', daysError)
      console.error('Error details:', {
        message: daysError.message,
        details: daysError.details,
        hint: daysError.hint,
        code: daysError.code
      })
      // Continue even if days fetch fails, just return weeks with empty days arrays
    }

    // Group days by week_id and sort by day_number within each week
    const daysByWeekId = new Map<string, Day[]>()
    if (daysData) {
      // Sort days by week_id first, then by day_number
      const sortedDays = [...daysData].sort((a, b) => {
        const weekCompare = a.week_id.localeCompare(b.week_id)
        if (weekCompare !== 0) return weekCompare
        return (a.day_number || 0) - (b.day_number || 0)
      })

      sortedDays.forEach(day => {
        const weekId = day.week_id
        if (!daysByWeekId.has(weekId)) {
          daysByWeekId.set(weekId, [])
        }
        daysByWeekId.get(weekId)!.push({
          id: day.id,
          name: day.name,
          sessions: day.sessions
        })
      })
    }

    // Map Supabase response to Week[] type
    const weeks: Week[] = weeksData.map(week => ({
      id: week.id,
      program_id: week.program_id,
      number: week.number,
      days: daysByWeekId.get(week.id) ?? [], // ensure days is always an array
    }))

    return weeks
  } catch (err) {
    console.error('fetchWeeks unexpected error:', err)
    return [] // safely return empty array
  }
}
