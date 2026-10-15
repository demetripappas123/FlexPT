import { supabase } from '../supabase'
import { fetchClients } from './fetchpeople'
import { fetchSessions, Session } from './fetchsessions'
import { fetchContracts, Contract } from './fetchcontracts'
import { fetchPersonPackages } from './fetchpersonpackages'
import { attachRemainingToPersonPackages } from './fetchpersonpackageswithremaining'
import { fetchPayments, Payment, isPaymentCountedForRevenue } from './fetchpayments'
import { fetchServices } from './fetchservices'
import { assignmentCompletedThisWeek } from '../utils/checkinWeek'

export type ClientRosterStatus = 'active' | 'paused' | 'trial' | 'ending' | 'inactive'
export type ClientRosterFlag =
  | 'payment_failed'
  | 'past_due'
  | 'expiring'
  | 'unscheduled'
  | 'checkin_overdue'

export type ClientRosterRow = {
  id: string
  name: string
  number: string | null
  status: ClientRosterStatus
  coachName: string | null
  nextSessionAt: string | null
  sessionsRemaining: number
  sessionsToSchedule: number
  lastActivityAt: string | null
  lastCheckInAt: string | null
  checkInsCompleted: number
  checkInCompletedThisWeek: boolean
  checkInOverdue: boolean
  nextBillAt: string | null
  nextBillAmount: number | null
  lastPaymentStatus: 'paid' | 'failed' | 'past_due' | 'none'
  lastPaymentAt: string | null
  contractEndsAt: string | null
  renewalDate: string | null
  renewalLabel: string
  flags: ClientRosterFlag[]
}

type TrainerRow = { id: string; name: string | null }
type WorkoutRow = {
  person_id: string
  completed: boolean | null
  workout_date: string | null
  created_at: string
}
type TaskRow = {
  person_id: string
  kind: string
  status: string
  due_date: string | null
  completed_at: string | null
}
type CheckinAssignmentRow = {
  person_id: string
  status: string
  assigned_date: string | null
  completed_at: string | null
}

function statusRank(status: ClientRosterStatus): number {
  switch (status) {
    case 'active':
      return 0
    case 'trial':
      return 1
    case 'ending':
      return 2
    case 'paused':
      return 3
    default:
      return 4
  }
}
function isSessionService(serviceType: string | null, serviceName: string | null): boolean {
  const type = (serviceType || '').toLowerCase()
  const name = (serviceName || '').toLowerCase()
  return type.includes('session') || name.includes('session')
}

function pickPrimaryContract(contracts: Contract[]): Contract | null {
  if (contracts.length === 0) return null
  const rank = (status: string | null) => {
    if (status === 'active') return 0
    if (status === 'frozen') return 1
    if (status === 'cancelled') return 2
    return 3
  }
  return [...contracts].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status)
    if (byStatus !== 0) return byStatus
    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0
    return bStart - aStart
  })[0]
}

function deriveStatus(
  personConvertedAt: string | null,
  contract: Contract | null,
  hasSucceededPayment: boolean,
  now: Date
): ClientRosterStatus {
  if (!contract) return 'inactive'
  if (contract.status === 'frozen') return 'paused'
  if (contract.status === 'cancelled') return 'inactive'
  if (contract.status !== 'active') return 'inactive'

  const converted = personConvertedAt ? new Date(personConvertedAt) : null
  const daysSinceConvert =
    converted && !Number.isNaN(converted.getTime())
      ? (now.getTime() - converted.getTime()) / 86400000
      : Infinity
  if (!hasSucceededPayment && daysSinceConvert <= 21) return 'trial'

  if (!contract.until_cancelled && contract.renewal_date) {
    const end = new Date(contract.renewal_date)
    if (!Number.isNaN(end.getTime())) {
      const daysUntilEnd = (end.getTime() - now.getTime()) / 86400000
      if (daysUntilEnd <= 21) return 'ending'
    }
  }

  return 'active'
}

function renewalLabel(contract: Contract | null): string {
  if (!contract || contract.status === 'cancelled') return 'None'
  if (contract.pif) return 'PIF'
  if (contract.until_cancelled) return 'Auto-renews'
  if (contract.renewal_date) return 'Ends'
  return 'None'
}

function nextUpcomingSession(sessions: Session[], now: Date): Session | null {
  const upcoming = sessions
    .filter((s) => {
      if (s.status === 'canceled_with_charge' || s.status === 'canceled_no_charge') return false
      if (s.status === 'completed') return false
      if (!s.start_time) return false
      return new Date(s.start_time).getTime() >= now.getTime() - 15 * 60 * 1000
    })
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())
  return upcoming[0] ?? null
}

export async function fetchClientRoster(trainerId: string): Promise<ClientRosterRow[]> {
  const [
    clients,
    sessions,
    contracts,
    personPackages,
    payments,
    services,
    trainersRes,
    workoutsRes,
    tasksRes,
  ] = await Promise.all([
    fetchClients(trainerId),
    fetchSessions(trainerId),
    fetchContracts(trainerId),
    fetchPersonPackages(trainerId),
    fetchPayments(trainerId),
    fetchServices(),
    supabase.from('trainers').select('id, name'),
    supabase.from('workouts').select('person_id, completed, workout_date, created_at'),
    supabase
      .from('tasks')
      .select('person_id, kind, status, due_date, completed_at')
      .eq('trainer_id', trainerId),
  ])

  const clientIds = clients.map((client) => client.id)
  const checkinsRes =
    clientIds.length === 0
      ? { data: [] as CheckinAssignmentRow[], error: null }
      : await supabase
          .from('checkin_form_assignments')
          .select('person_id, status, assigned_date, completed_at')
          .in('person_id', clientIds)

  if (trainersRes.error) console.error('Error fetching trainers:', trainersRes.error)
  if (workoutsRes.error) console.error('Error fetching workouts:', workoutsRes.error)
  if (tasksRes.error) console.error('Error fetching tasks:', tasksRes.error)
  if (checkinsRes.error) console.error('Error fetching check-in assignments:', checkinsRes.error)

  const trainers = (trainersRes.data ?? []) as TrainerRow[]
  const workouts = (workoutsRes.data ?? []) as WorkoutRow[]
  const tasks = (tasksRes.data ?? []) as TaskRow[]
  const checkins = (checkinsRes.data ?? []) as CheckinAssignmentRow[]
  const trainerNameById = new Map(trainers.map((t) => [t.id, t.name || null]))

  const packagesWithRemaining = await attachRemainingToPersonPackages(personPackages, services)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const sessionsByPerson = new Map<string, Session[]>()
  for (const session of sessions) {
    if (!session.person_id) continue
    const list = sessionsByPerson.get(session.person_id) ?? []
    list.push(session)
    sessionsByPerson.set(session.person_id, list)
  }

  const contractsByPerson = new Map<string, Contract[]>()
  for (const contract of contracts) {
    if (!contract.person_id) continue
    const list = contractsByPerson.get(contract.person_id) ?? []
    list.push(contract)
    contractsByPerson.set(contract.person_id, list)
  }

  const packagesByPerson = new Map<string, typeof packagesWithRemaining>()
  for (const row of packagesWithRemaining) {
    if (!row.person_id) continue
    const list = packagesByPerson.get(row.person_id) ?? []
    list.push(row)
    packagesByPerson.set(row.person_id, list)
  }

  const paymentsByContract = new Map<string, Payment[]>()
  for (const payment of payments) {
    const list = paymentsByContract.get(payment.contract_id) ?? []
    list.push(payment)
    paymentsByContract.set(payment.contract_id, list)
  }

  const workoutsByPerson = new Map<string, WorkoutRow[]>()
  for (const workout of workouts) {
    const list = workoutsByPerson.get(workout.person_id) ?? []
    list.push(workout)
    workoutsByPerson.set(workout.person_id, list)
  }

  const tasksByPerson = new Map<string, TaskRow[]>()
  for (const task of tasks) {
    const list = tasksByPerson.get(task.person_id) ?? []
    list.push(task)
    tasksByPerson.set(task.person_id, list)
  }

  const checkinsByPerson = new Map<string, CheckinAssignmentRow[]>()
  for (const assignment of checkins) {
    const list = checkinsByPerson.get(assignment.person_id) ?? []
    list.push(assignment)
    checkinsByPerson.set(assignment.person_id, list)
  }

  const mapped = clients.map((client) => {
    const personContracts = contractsByPerson.get(client.id) ?? []
    const contract = pickPrimaryContract(personContracts)
    const personPayments = personContracts.flatMap((c) => paymentsByContract.get(c.id) ?? [])
    const latestPayment = [...personPayments].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    )[0]
    const hasSucceededPayment = personPayments.some(isPaymentCountedForRevenue)
    const latestFailed =
      latestPayment && (latestPayment.status ?? '').toLowerCase() === 'failed'

    const personPackagesForClient = packagesByPerson.get(client.id) ?? []
    const paidSessionPackages = personPackagesForClient.filter(
      (pp) => pp.status === 'paid' && isSessionService(pp.service_type, pp.service_name)
    )
    const sessionsRemaining = paidSessionPackages.reduce((sum, pp) => sum + pp.remaining_units, 0)

    const personTasks = tasksByPerson.get(client.id) ?? []
    const sessionsToSchedule = personTasks.filter(
      (t) => t.kind === 'session' && t.status === 'open'
    ).length

    const nextSession = nextUpcomingSession(sessionsByPerson.get(client.id) ?? [], now)

    const completedWorkouts = (workoutsByPerson.get(client.id) ?? []).filter((w) => w.completed)
    const lastWorkoutAt = completedWorkouts
      .map((w) => w.workout_date || w.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

    const lastCompletedSession = (sessionsByPerson.get(client.id) ?? [])
      .filter((s) => s.status === 'completed')
      .map((s) => s.end_time || s.start_time)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null

    const lastActivityAt =
      [lastWorkoutAt, lastCompletedSession].filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ??
      null

    const personCheckins = checkinsByPerson.get(client.id) ?? []
    const lastCheckInAt =
      personCheckins
        .filter((row) => row.status === 'completed' && row.completed_at)
        .map((row) => row.completed_at as string)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

    const checkInsCompleted = personCheckins.filter((row) => row.status === 'completed').length
    const checkInCompletedThisWeek = personCheckins.some((row) => assignmentCompletedThisWeek(row, now))

    const checkInOverdue = personCheckins.some((row) => {
      if (row.status === 'completed' || !row.assigned_date) return false
      const due = new Date(`${row.assigned_date}T00:00:00`)
      return !Number.isNaN(due.getTime()) && due < startOfToday
    })

    const nextBillCandidates = personPackagesForClient
      .filter((pp) => pp.status === 'paid' && pp.next_payment_date)
      .map((pp) => pp.next_payment_date as string)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    const nextBillAt = contract?.pif ? null : nextBillCandidates[0] ?? contract?.renewal_date ?? null
    const nextBillAmount = contract?.pif ? null : contract?.cost_per_bill_cycle ?? null
    const nextBillPast =
      nextBillAt != null && !Number.isNaN(new Date(nextBillAt).getTime()) && new Date(nextBillAt) < startOfToday

    let lastPaymentStatus: ClientRosterRow['lastPaymentStatus'] = 'none'
    if (latestFailed) lastPaymentStatus = 'failed'
    else if (nextBillPast) lastPaymentStatus = 'past_due'
    else if (hasSucceededPayment) lastPaymentStatus = 'paid'

    const status = deriveStatus(client.converted_at, contract, hasSucceededPayment, now)
    const flags: ClientRosterFlag[] = []
    if (latestFailed) flags.push('payment_failed')
    if (nextBillPast) flags.push('past_due')
    if (status === 'ending') flags.push('expiring')
    if (sessionsRemaining > 0 && !nextSession) flags.push('unscheduled')
    if (checkInOverdue) flags.push('checkin_overdue')

    return {
      id: client.id,
      name: client.name,
      number: client.number ?? null,
      status,
      coachName: client.trainer_id ? trainerNameById.get(client.trainer_id) ?? null : null,
      nextSessionAt: nextSession?.start_time ?? null,
      sessionsRemaining,
      sessionsToSchedule,
      lastActivityAt,
      lastCheckInAt,
      checkInsCompleted,
      checkInOverdue,
      checkInCompletedThisWeek,
      nextBillAt,
      nextBillAmount,
      lastPaymentStatus,
      lastPaymentAt: latestPayment?.payment_date ?? null,
      contractEndsAt: contract?.until_cancelled ? null : contract?.renewal_date ?? null,
      renewalDate:
        contract?.renewal_date ??
        (contract?.until_cancelled && !contract.pif ? nextBillCandidates[0] ?? null : null),
      renewalLabel: renewalLabel(contract),
      flags,
    }
  })

  return mapped.sort((a, b) => {
    const byStatus = statusRank(a.status) - statusRank(b.status)
    if (byStatus !== 0) return byStatus
    return a.name.localeCompare(b.name)
  })
}
