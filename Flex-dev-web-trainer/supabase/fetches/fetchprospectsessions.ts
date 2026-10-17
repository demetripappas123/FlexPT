import { supabase } from '../supabaseClient'
import { Session, SessionType } from './fetchsessions'
import { DateRangeBounds } from '../utils/daterange'

/**
 * Fetch all prospect sessions (Prospect Session, Intro Session, Followup Session)
 * Optionally filtered by date range (based on created_at)
 */
export async function fetchProspectSessions(
  dateRange?: DateRangeBounds,
  trainerId?: string | null
): Promise<Session[]> {
  if (!trainerId) return []

  const prospectTypes: SessionType[] = ['Prospect Session', 'Intro Session', 'Followup Session']
  
  let query = supabase
    .from('sessions')
    .select('*')
    .eq('trainer_id', trainerId)
    .in('type', prospectTypes)

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching prospect sessions:', error)
    throw error
  }

  return data ?? []
}

/**
 * Close rate is closes / completed lead sessions.
 * A close is the session marked role=close on a conversion.
 * Older rows that only set sessions.converted still count when they were never linked.
 */
export async function calculateProspectSessionCloseRate(
  dateRange?: DateRangeBounds,
  trainerId?: string | null
): Promise<number | null> {
  const prospectSessions = await fetchProspectSessions(dateRange, trainerId)
  const completedSessions = prospectSessions.filter(s => s.status === 'completed')
  if (completedSessions.length === 0) return null

  const ids = completedSessions.map((session) => session.id)
  const { data, error } = await supabase
    .from('conversion_sessions')
    .select('session_id, role')
    .in('session_id', ids)

  if (error) {
    console.error('Error fetching conversion sessions for close rate:', error)
  }

  const linked = new Set((data ?? []).map((row) => row.session_id as string))
  const closes = new Set(
    (data ?? []).filter((row) => row.role === 'close').map((row) => row.session_id as string)
  )
  const convertedSessions = completedSessions.filter(
    (session) => closes.has(session.id) || (session.converted && !linked.has(session.id))
  ).length

  return (convertedSessions / completedSessions.length) * 100
}

/**
 * Calculate show rate based on prospect sessions
 * Show rate = completed sessions / (completed + cancelled sessions) * 100
 * Only considers prospect sessions: Prospect Session, Intro Session, Followup Session
 * Optionally filtered by date range
 */
export async function calculateProspectSessionShowRate(
  dateRange?: DateRangeBounds,
  trainerId?: string | null
): Promise<number | null> {
  const prospectSessions = await fetchProspectSessions(dateRange, trainerId)
  
  // Filter for completed sessions
  const completedSessions = prospectSessions.filter(s => s.status === 'completed')
  
  // Filter for cancelled sessions (with or without charge)
  const cancelledSessions = prospectSessions.filter(s => 
    s.status === 'canceled_with_charge' || s.status === 'canceled_no_charge'
  )
  
  const totalRelevantSessions = completedSessions.length + cancelledSessions.length
  
  if (totalRelevantSessions === 0) return null
  
  return (completedSessions.length / totalRelevantSessions) * 100
}

