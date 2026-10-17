import { supabase } from '../supabaseClient'
import { Session, SessionType } from '../fetches/fetchsessions'
import { PROSPECT_SESSION_TYPES } from './dashboardMetrics'

export type ConversionRole = 'touch' | 'close'

export type ConversionSession = {
  id: string
  contract_id: string
  session_id: string
  person_id: string
  trainer_id: string | null
  session_type: string
  role: ConversionRole
  created_at: string
}

export function leadSessionWhen(session: Pick<Session, 'start_time' | 'started_at' | 'created_at'>): number {
  const raw = session.start_time || session.started_at || session.created_at
  const time = new Date(raw).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function completedLeadSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((session) => session.status === 'completed' && PROSPECT_SESSION_TYPES.includes(session.type as SessionType))
    .sort((a, b) => leadSessionWhen(a) - leadSessionWhen(b))
}

/** Latest selected session is the close. Earlier selected sessions are touches. */
export function assignConversionRoles(orderedSessionIds: string[], selectedIds: Set<string>): { sessionId: string; role: ConversionRole }[] {
  const selected = orderedSessionIds.filter((id) => selectedIds.has(id))
  return selected.map((sessionId, index) => ({
    sessionId,
    role: index === selected.length - 1 ? 'close' : 'touch',
  }))
}

export async function saveConversionSessions(input: {
  contractId: string
  personId: string
  trainerId: string
  sessions: Session[]
  selectedIds: Set<string>
}): Promise<void> {
  const ordered = completedLeadSessions(input.sessions)
  const roles = assignConversionRoles(ordered.map((session) => session.id), input.selectedIds)
  if (roles.length === 0) return

  const byId = new Map(ordered.map((session) => [session.id, session]))
  const rows = roles.map((entry) => ({
    contract_id: input.contractId,
    session_id: entry.sessionId,
    person_id: input.personId,
    trainer_id: input.trainerId,
    session_type: byId.get(entry.sessionId)?.type ?? 'Prospect Session',
    role: entry.role,
  }))

  const { error } = await supabase.from('conversion_sessions').insert(rows)
  if (error) throw error

  await Promise.all(
    roles.map((entry) =>
      supabase.from('sessions').update({ converted: entry.role === 'close' }).eq('id', entry.sessionId)
    )
  )
}

export async function fetchConversionSessionsForPerson(personId: string): Promise<ConversionSession[]> {
  const { data, error } = await supabase
    .from('conversion_sessions')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching conversion sessions:', error)
    throw error
  }

  return (data ?? []) as ConversionSession[]
}

export function conversionPathLabel(rows: ConversionSession[]): string | null {
  if (rows.length === 0) return null
  const close = rows.find((row) => row.role === 'close')
  const closeType = close?.session_type ?? rows[rows.length - 1].session_type
  if (rows.length === 1) return `Closed on ${closeType}`
  return `${rows.length} lead sessions · closed on ${closeType}`
}
