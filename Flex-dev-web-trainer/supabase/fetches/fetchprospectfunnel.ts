import { supabase } from '../supabaseClient'
import { Session, SessionType } from './fetchsessions'
import { fetchProspects } from './fetchpeople'
import { DateRangeBounds } from '../utils/daterange'
import { PROSPECT_SESSION_TYPES } from '../utils/dashboardMetrics'

export type ProspectTypeStat = {
  type: SessionType
  label: string
  sessions: number
  dealsClosed: number
  showRate: number | null
  closeRate: number | null
}

export type ProspectClosePath = {
  type: SessionType
  sessions: number
}

export type LeadFlowSession = {
  id: string
  personId: string
  type: SessionType
  status: Session['status']
  at: number
  inRange: boolean
  closed: boolean
  rejectionReason: string | null
}

export type ProspectLeadRow = {
  personId: string
  name: string
  bucket: 'hot' | 'cold'
  status: string
  detail: string
  when: string | null
}

export type ProspectFunnel = {
  byType: ProspectTypeStat[]
  paths: ProspectClosePath[]
  flow: LeadFlowSession[]
  leads: ProspectLeadRow[]
}

const TYPE_LABEL: Record<SessionType, string> = {
  'Client Session': 'Client',
  'Prospect Session': 'Prospect',
  'Intro Session': 'Intro',
  'Followup Session': 'Follow-up',
}

function sessionStamp(session: Session): number {
  const raw = session.start_time || session.created_at
  const time = new Date(raw).getTime()
  return Number.isNaN(time) ? 0 : time
}

function inRange(time: number, bounds: DateRangeBounds | null): boolean {
  if (!bounds) return true
  return time >= bounds.start.getTime() && time <= bounds.end.getTime()
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

/**
 * Show and close rates for each lead session type, plus how many credited
 * sessions it takes to close. A path only counts when it has exactly one close.
 */
export async function fetchProspectFunnel(
  trainerId?: string | null,
  bounds: DateRangeBounds | null = null
): Promise<ProspectFunnel> {
  const [sessionResult, prospects] = await Promise.all([
    (() => {
      let query = supabase.from('sessions').select('*').in('type', PROSPECT_SESSION_TYPES)
      if (trainerId) query = query.eq('trainer_id', trainerId)
      return query
    })(),
    trainerId ? fetchProspects(trainerId) : Promise.resolve([]),
  ])
  if (sessionResult.error) throw sessionResult.error

  const allSessions = (sessionResult.data ?? []) as Session[]
  const sessions = allSessions.filter((session) => inRange(sessionStamp(session), bounds))
  const ids = allSessions.map((session) => session.id)

  let rangeLinks: { session_id: string; contract_id: string; role: string }[] = []
  if (ids.length > 0) {
    const { data: rows, error: linkError } = await supabase
      .from('conversion_sessions')
      .select('session_id, contract_id, role')
      .in('session_id', ids)
    if (linkError) console.error('Error fetching conversion sessions:', linkError)
    rangeLinks = (rows ?? []) as typeof rangeLinks
  }

  const linked = new Set(rangeLinks.map((row) => row.session_id))
  const closeContractIds = [...new Set(rangeLinks.filter((row) => row.role === 'close').map((row) => row.contract_id))]

  let pathRows: { contract_id: string; role: string }[] = []
  if (closeContractIds.length > 0) {
    const { data: paths, error: pathError } = await supabase
      .from('conversion_sessions')
      .select('contract_id, role')
      .in('contract_id', closeContractIds)
    if (pathError) console.error('Error fetching close paths:', pathError)
    pathRows = (paths ?? []) as typeof pathRows
  }

  const closeTypeByContract = new Map<string, SessionType>()
  for (const link of rangeLinks) {
    if (link.role !== 'close') continue
    const session = sessions.find((item) => item.id === link.session_id)
    if (session) closeTypeByContract.set(link.contract_id, session.type)
  }

  const byContract = new Map<string, { closes: number; total: number }>()
  for (const row of pathRows) {
    const current = byContract.get(row.contract_id) ?? { closes: 0, total: 0 }
    current.total += 1
    if (row.role === 'close') current.closes += 1
    byContract.set(row.contract_id, current)
  }

  const paths: ProspectClosePath[] = []
  for (const [contractId, path] of byContract) {
    if (path.closes !== 1) continue
    const type = closeTypeByContract.get(contractId)
    if (!type) continue
    paths.push({ type, sessions: path.total })
  }

  const dealsByType = new Map<SessionType, number>()
  for (const path of paths) {
    dealsByType.set(path.type, (dealsByType.get(path.type) ?? 0) + 1)
  }

  for (const session of sessions) {
    if (session.status !== 'completed' || linked.has(session.id) || !session.converted) continue
    paths.push({ type: session.type, sessions: 1 })
    dealsByType.set(session.type, (dealsByType.get(session.type) ?? 0) + 1)
  }

  const byType = PROSPECT_SESSION_TYPES.map((type) => {
    const ofType = sessions.filter((session) => session.type === type)
    const completed = ofType.filter((session) => session.status === 'completed')
    const cancelled = ofType.filter(
      (session) => session.status === 'canceled_with_charge' || session.status === 'canceled_no_charge'
    )
    const dealsClosed = dealsByType.get(type) ?? 0
    return {
      type,
      label: TYPE_LABEL[type],
      sessions: ofType.length,
      dealsClosed,
      showRate: rate(completed.length, completed.length + cancelled.length),
      closeRate: rate(dealsClosed, completed.length),
    }
  })

  const closeSessionIds = new Set(
    rangeLinks.filter((row) => row.role === 'close').map((row) => row.session_id)
  )
  const flow: LeadFlowSession[] = allSessions
    .filter((session) => session.person_id)
    .map((session) => ({
      id: session.id,
      personId: session.person_id as string,
      type: session.type,
      status: session.status,
      at: sessionStamp(session),
      inRange: inRange(sessionStamp(session), bounds),
      closed: closeSessionIds.has(session.id) || (session.converted && !linked.has(session.id)),
      rejectionReason: session.rejection_reason?.trim() || null,
    }))

  return { byType, paths, flow, leads: classifyLeads(prospects, flow) }
}

const RECENT_MS = 14 * 24 * 60 * 60 * 1000

function classifyLeads(
  prospects: { id: string; name: string; lead_bucket?: 'hot' | 'cold' | null }[],
  flow: LeadFlowSession[]
): ProspectLeadRow[] {
  const now = Date.now()
  const byPerson = new Map<string, LeadFlowSession[]>()
  for (const session of flow) {
    const list = byPerson.get(session.personId) ?? []
    list.push(session)
    byPerson.set(session.personId, list)
  }

  return prospects.map((person) => {
    const manual = person.lead_bucket === 'hot' || person.lead_bucket === 'cold' ? person.lead_bucket : null
    const chain = (byPerson.get(person.id) ?? []).sort((a, b) => a.at - b.at)
    const upcoming = [...chain]
      .filter((session) => session.status === 'pending' || session.status === 'in_progress')
      .filter((session) => session.at >= now - 60 * 60 * 1000)
      .sort((a, b) => a.at - b.at)[0]
    const recent = [...chain]
      .filter((session) => session.status !== 'canceled_with_charge' && session.status !== 'canceled_no_charge')
      .filter((session) => now - session.at <= RECENT_MS && session.at <= now)
      .sort((a, b) => b.at - a.at)[0]
    const latest = chain[chain.length - 1]

    if (upcoming) {
      const followup = upcoming.type === 'Followup Session'
      return {
        personId: person.id,
        name: person.name,
        bucket: manual ?? 'hot',
        status: followup ? 'Follow-up scheduled' : 'Actively scheduled',
        detail: upcoming.type,
        when: new Date(upcoming.at).toISOString(),
      }
    }
    if (recent) {
      return {
        personId: person.id,
        name: person.name,
        bucket: manual ?? 'hot',
        status: recent.type === 'Followup Session' ? 'On follow-up' : 'Recently scheduled',
        detail: recent.type,
        when: new Date(recent.at).toISOString(),
      }
    }
    if (!latest) {
      return {
        personId: person.id,
        name: person.name,
        bucket: manual ?? 'hot',
        status: 'Not booked',
        detail: 'No lead session yet',
        when: null,
      }
    }

    let reason = latest.rejectionReason || 'Showed, did not close'
    if (!latest.rejectionReason && latest.status === 'canceled_with_charge') reason = 'Cancelled, charged'
    else if (!latest.rejectionReason && latest.status === 'canceled_no_charge') reason = 'Cancelled, no charge'
    else if (!latest.rejectionReason && (latest.status === 'pending' || latest.status === 'in_progress')) reason = 'No-show'
    else if (latest.closed) reason = 'Closed'
    return {
      personId: person.id,
      name: person.name,
      bucket: manual ?? (latest.closed ? 'hot' : 'cold'),
      status: latest.closed ? 'Closed' : reason,
      detail: latest.type,
      when: new Date(latest.at).toISOString(),
    }
  })
}
