import { supabase } from '../supabaseClient'
import { Session, SessionType, SessionStatus } from '../fetches/fetchsessions'

export interface CreateSessionData {
  person_id: string
  trainer_id?: string | null
  type: SessionType
  start_time?: string | null
  end_time?: string | null
  person_package_id?: string | null
  converted?: boolean
  status?: SessionStatus
}

/**
 * Create a new session (without a workout)
 * This is the initial session creation - workout assignment happens later
 */
export async function createSession(sessionData: CreateSessionData): Promise<Session> {
  const data: any = {
    person_id: sessionData.person_id,
    type: sessionData.type,
    converted: sessionData.converted ?? false,
    status: sessionData.status ?? 'pending',
  }
  
  // Only include optional fields if they have values
  if (sessionData.trainer_id !== undefined && sessionData.trainer_id !== null) {
    data.trainer_id = sessionData.trainer_id
  }
  if (sessionData.person_package_id !== undefined && sessionData.person_package_id !== null) {
    data.person_package_id = sessionData.person_package_id
  }
  if (sessionData.start_time !== undefined && sessionData.start_time !== null) {
    data.start_time = sessionData.start_time
  }
  if (sessionData.end_time !== undefined && sessionData.end_time !== null) {
    data.end_time = sessionData.end_time
  }

  const { data: createdSession, error } = await supabase
    .from('sessions')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating session:', error)
    throw error
  }

  return createdSession
}

