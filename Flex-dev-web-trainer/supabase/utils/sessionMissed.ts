import { Session } from '../fetches/fetchsessions'
import { supabase } from '../supabaseClient'
import { upsertSession } from '../upserts/upsertsession'

export type SessionMissed = 'suggested' | 'missed' | 'cancelled'

export const MISSED_GRACE_MINUTES = 15

export function sessionLooksMissed(session: Session, now = new Date()): boolean {
  if (session.status !== 'pending') return false
  if (session.missed === 'missed' || session.missed === 'cancelled') return false
  if (!session.start_time) return false
  const start = new Date(session.start_time)
  if (Number.isNaN(start.getTime())) return false
  return now.getTime() >= start.getTime() + MISSED_GRACE_MINUTES * 60 * 1000
}

export function sessionMissedLabel(session: Session): string | null {
  const charged = session.status === 'canceled_with_charge'
  if (session.missed === 'suggested') return 'Looks missed'
  if (session.missed === 'missed') return charged ? 'Missed (charged)' : 'Missed (no charge)'
  if (session.missed === 'cancelled') return charged ? 'Cancelled (charged)' : 'Cancelled (no charge)'
  if (session.status === 'canceled_with_charge') return 'Cancelled (charged)'
  if (session.status === 'canceled_no_charge') return 'Cancelled (no charge)'
  return null
}

export async function suggestMissedSessions(sessions: Session[], now = new Date()): Promise<Session[]> {
  const ids = sessions
    .filter((session) => sessionLooksMissed(session, now) && session.missed !== 'suggested')
    .map((session) => session.id)

  if (ids.length > 0) {
    const { error } = await supabase.from('sessions').update({ missed: 'suggested' }).in('id', ids)
    if (error) {
      console.error('Error suggesting missed sessions:', error)
      throw error
    }
  }

  const suggested = new Set(ids)
  return sessions.map((session) =>
    suggested.has(session.id) ? { ...session, missed: 'suggested' } : session
  )
}

export async function markSessionMissed(session: Session, withCharge: boolean): Promise<Session> {
  return upsertSession({
    id: session.id,
    type: session.type,
    person_id: session.person_id,
    trainer_id: session.trainer_id,
    start_time: session.start_time,
    started_at: session.started_at,
    end_time: session.end_time,
    workout_id: session.workout_id,
    person_package_id: session.person_package_id,
    converted: session.converted,
    status: withCharge ? 'canceled_with_charge' : 'canceled_no_charge',
    missed: 'missed',
  })
}

export async function markSessionCancelled(session: Session, withCharge: boolean): Promise<Session> {
  return upsertSession({
    id: session.id,
    type: session.type,
    person_id: session.person_id,
    trainer_id: session.trainer_id,
    start_time: session.start_time,
    started_at: session.started_at,
    end_time: session.end_time,
    workout_id: session.workout_id,
    person_package_id: session.person_package_id,
    converted: session.converted,
    status: withCharge ? 'canceled_with_charge' : 'canceled_no_charge',
    missed: 'cancelled',
  })
}
