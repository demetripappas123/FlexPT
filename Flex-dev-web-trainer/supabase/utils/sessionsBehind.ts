import { fetchContracts, Contract } from '../fetches/fetchcontracts'
import { fetchPersonPackages, PersonPackage } from '../fetches/fetchpersonpackages'
import { fetchServices, Service } from '../fetches/fetchservices'
import { fetchSessions, Session } from '../fetches/fetchsessions'
import { fetchClients } from '../fetches/fetchpeople'

export type ClientSessionsBehind = {
  personId: string
  personName: string
  sessionsBehind: number
  expected: number
  held: number
}

type PaceTotal = {
  behind: number
  expected: number
  used: number
}

function isSessionService(serviceType: string | null | undefined, serviceName: string | null | undefined): boolean {
  const type = (serviceType || '').toLowerCase()
  const name = (serviceName || '').toLowerCase()
  return type.includes('session') || name.includes('session')
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function wholeWeeksSince(start: Date, now: Date): number {
  const elapsed = now.getTime() - start.getTime()
  if (elapsed <= 0) return 0
  return Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000))
}

function sessionHeld(session: Session, now: Date): boolean {
  if (session.status !== 'completed' && session.status !== 'in_progress') return false
  const raw = session.started_at || session.end_time || session.start_time
  if (!raw) return false
  const when = new Date(raw)
  return !isNaN(when.getTime()) && when.getTime() <= now.getTime()
}

function weeklyCadence(contract: Contract, packages: PersonPackage[]): number | null {
  if (contract.pif && contract.suggested_sessions_per_week) {
    const pace = Number(contract.suggested_sessions_per_week)
    if (pace > 0) return pace
  }

  const latest = [...packages].sort((a, b) => {
    const aTime = parseDate(a.payment_date)?.getTime() ?? 0
    const bTime = parseDate(b.payment_date)?.getTime() ?? 0
    return bTime - aTime
  })

  for (const row of latest) {
    const units = Number(row.units_per_obligation_cycle) || 0
    const weeks = Math.max(1, Number(row.obligation_cycle_length_weeks) || 1)
    if (units > 0) return units / weeks
  }

  const fallback = Number(contract.suggested_sessions_per_week)
  return fallback > 0 ? fallback : null
}

/** Sessions owed since the contract started, across every paid session package on it. */
export function sessionsBehindByPerson(input: {
  contracts: Contract[]
  personPackages: PersonPackage[]
  services: Service[]
  sessions: Session[]
  now?: Date
}): Map<string, PaceTotal> {
  const now = input.now ?? new Date()
  const serviceById = new Map(input.services.map((service) => [service.id, service]))
  const sessionsByPackage = new Map<string, Session[]>()

  for (const session of input.sessions) {
    if (!session.person_package_id || !sessionHeld(session, now)) continue
    const list = sessionsByPackage.get(session.person_package_id) ?? []
    list.push(session)
    sessionsByPackage.set(session.person_package_id, list)
  }

  const totals = new Map<string, PaceTotal>()

  for (const contract of input.contracts) {
    if (contract.status !== 'active' || !contract.person_id) continue

    const packages = input.personPackages.filter((row) => {
      if (row.contract_id !== contract.id || row.status !== 'paid') return false
      const service = serviceById.get(row.service_id)
      return isSessionService(service?.service_type, service?.name)
    })
    if (packages.length === 0) continue

    const cadence = weeklyCadence(contract, packages)
    if (!cadence) continue

    const start =
      parseDate(contract.start_date) ??
      packages
        .map((row) => parseDate(row.payment_date))
        .filter((date): date is Date => date != null)
        .sort((a, b) => a.getTime() - b.getTime())[0]
    if (!start) continue

    const paidFor = packages.reduce((sum, row) => sum + (Number(row.units_per_obligation_cycle) || 0), 0)
    const used = packages.reduce((sum, row) => sum + (sessionsByPackage.get(row.id)?.length ?? 0), 0)
    const expected = Math.min(paidFor, Math.floor(cadence * wholeWeeksSince(start, now)))
    const behind = Math.max(0, expected - used)
    if (behind <= 0) continue

    const current = totals.get(contract.person_id) ?? { behind: 0, expected: 0, used: 0 }
    totals.set(contract.person_id, {
      behind: current.behind + behind,
      expected: current.expected + expected,
      used: current.used + used,
    })
  }

  return totals
}

export async function fetchClientsBehindOnSessions(trainerId: string): Promise<ClientSessionsBehind[]> {
  const [contracts, personPackages, services, sessions, clients] = await Promise.all([
    fetchContracts(trainerId),
    fetchPersonPackages(trainerId),
    fetchServices(),
    fetchSessions(trainerId),
    fetchClients(trainerId),
  ])

  const behindByPerson = sessionsBehindByPerson({ contracts, personPackages, services, sessions })
  const nameById = new Map(clients.map((client) => [client.id, client.name]))

  return [...behindByPerson.entries()]
    .map(([personId, total]) => ({
      personId,
      personName: nameById.get(personId) || 'Client',
      sessionsBehind: total.behind,
      expected: total.expected,
      held: total.used,
    }))
    .sort((a, b) => b.sessionsBehind - a.sessionsBehind || a.personName.localeCompare(b.personName))
}

export async function fetchPersonSessionsBehind(personId: string, trainerId?: string | null): Promise<number> {
  const [contracts, personPackages, services, sessions] = await Promise.all([
    fetchContracts(trainerId),
    fetchPersonPackages(trainerId),
    fetchServices(),
    fetchSessions(trainerId),
  ])

  const personContracts = contracts.filter((contract) => contract.person_id === personId)
  const packageIds = new Set(
    personPackages.filter((row) => row.person_id === personId).map((row) => row.id)
  )

  return (
    sessionsBehindByPerson({
      contracts: personContracts,
      personPackages: personPackages.filter((row) => row.person_id === personId),
      services,
      sessions: sessions.filter((session) => session.person_package_id && packageIds.has(session.person_package_id)),
    }).get(personId)?.behind ?? 0
  )
}
