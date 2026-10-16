import { supabase } from '../supabaseClient'
import { Session, SessionType } from './fetchsessions'
import { DateRangeBounds } from '../utils/daterange'

/**
 * Fetch all prospect sessions (Prospect Session, Intro Session, Followup Session)
 * Optionally filtered by date range (based on created_at)
 */
export async function fetchProspectSessions(dateRange?: DateRangeBounds): Promise<Session[]> {
  const prospectTypes: SessionType[] = ['Prospect Session', 'Intro Session', 'Followup Session']
  
  let query = supabase
    .from('sessions')
    .select('*')
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
 * Close rate from sessions.converted (consult attribution), not people.converted_at.
 * Conversion itself happens when a package is assigned. Wire this flag later
 * if we want to know which session closed them.
 */
export async function calculateProspectSessionCloseRate(dateRange?: DateRangeBounds): Promise<number | null> {
  const prospectSessions = await fetchProspectSessions(dateRange)
  
  // Filter for completed sessions only
  const completedSessions = prospectSessions.filter(s => s.status === 'completed')
  
  if (completedSessions.length === 0) return null
  
  const convertedSessions = completedSessions.filter(s => s.converted === true).length
  const totalCompletedSessions = completedSessions.length
  
  return (convertedSessions / totalCompletedSessions) * 100
}

/**
 * Calculate show rate based on prospect sessions
 * Show rate = completed sessions / (completed + cancelled sessions) * 100
 * Only considers prospect sessions: Prospect Session, Intro Session, Followup Session
 * Optionally filtered by date range
 */
export async function calculateProspectSessionShowRate(dateRange?: DateRangeBounds): Promise<number | null> {
  const prospectSessions = await fetchProspectSessions(dateRange)
  
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

