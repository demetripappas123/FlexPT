import { supabase } from '../supabase'
import { fetchClients, personIsInOnboarding } from './fetchpeople'
import { fetchSessions, Session } from './fetchsessions'
import { fetchContracts, Contract } from './fetchcontracts'
import { fetchPersonPackages } from './fetchpersonpackages'
import { attachRemainingToPersonPackages } from './fetchpersonpackageswithremaining'
import { fetchPayments, Payment, isPaymentCountedForRevenue } from './fetchpayments'
import { fetchServices } from './fetchservices'
import { assignmentCompletedThisWeek } from '../utils/checkinWeek'
import {
  calculateComplianceScore,
  complianceWindow,
  complianceTooltip,
  ComplianceScore,
} from '../utils/complianceScore'

export type ClientRosterStatus = 'active' | 'paused' | 'trial' | 'ending' | 'inactive'
export type ClientRosterFlag =
  | 'payment_failed'
  | 'past_due'
  | 'expiring'
  | 'unscheduled'
  | 'checkin_overdue'
export type ClientRosterFilter = 'all' | 'active' | 'onboarding' | 'renewal' | 'at_risk' | 'inactive'

export const ONBOARDING_WINDOW_DAYS = 21
export const AT_RISK_COMPLIANCE_THRESHOLD = 60

export const CLIENT_ROSTER_FILTERS: { id: ClientRosterFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'onboarding', label: 'Active in onboarding' },
  { id: 'renewal', label: 'Up for renewal' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'inactive', label: 'Inactive' },
]

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
  compliance: ComplianceScore
  complianceLabel: string
  inOnboarding: boolean
  atRisk: boolean
}

export function matchesClientRosterFilter(row: ClientRosterRow, filter: ClientRosterFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'active':
      return row.status === 'active' && !row.inOnboarding
    case 'onboarding':
      return row.inOnboarding
    case 'renewal':
      return row.status === 'ending' || row.flags.includes('expiring')
    case 'at_risk':
      return row.atRisk
    case 'inactive':
      return row.status === 'inactive' || row.status === 'paused'
  }
}

export function countClientRosterFilters(rows: ClientRosterRow[]): Record<ClientRosterFilter, number> {
  const counts: Record<ClientRosterFilter, number> = {
    all: rows.length,
    active: 0,
    onboarding: 0,
    renewal: 0,
    at_risk: 0,
    inactive: 0,
  }
  for (const row of rows) {
    if (matchesClientRosterFilter(row, 'active')) counts.active += 1
    if (matchesClientRosterFilter(row, 'onboarding')) counts.onboarding += 1
    if (matchesClientRosterFilter(row, 'renewal')) counts.renewal += 1
    if (matchesClientRosterFilter(row, 'at_risk')) counts.at_risk += 1
    if (matchesClientRosterFilter(row, 'inactive')) counts.inactive += 1
  }
  return counts
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
  purpose?: string | null
}
type MealRow = {
  person_id: string
  status: string | null
  assigned_date: string | null
}
type NutritionRow = {
  client_id: string
  entry_date: string | null
  calories: number | null
  extra_calories: number | null
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
  const window = complianceWindow()
  const empty = { data: [] as never[], error: null }
  const [checkinsRes, mealsRes, nutritionRes] =
    clientIds.length === 0
      ? [empty, empty, empty]
      : await Promise.all([
          supabase
            .from('checkin_form_assignments')
            .select('person_id, status, assigned_date, completed_at, purpose')
            .in('person_id', clientIds),
          supabase
            .from('meals_occurances')
            .select('person_id, status, assigned_date')
            .in('person_id', clientIds)
            .gte('assigned_date', window.start)
            .lte('assigned_date', window.end),
          supabase
            .from('nutrition_entries')
            .select('client_id, entry_date, calories, extra_calories')
            .in('client_id', clientIds)
            .gte('entry_date', window.start)
            .lte('entry_date', window.end),
        ])

  if (trainersRes.error) console.error('Error fetching trainers:', trainersRes.error)
  if (workoutsRes.error) console.error('Error fetching workouts:', workoutsRes.error)
  if (tasksRes.error) console.error('Error fetching tasks:', tasksRes.error)
  if (checkinsRes.error) console.error('Error fetching check-in assignments:', checkinsRes.error)
  if (mealsRes.error) console.error('Error fetching assigned meals:', mealsRes.error)
  if (nutritionRes.error) console.error('Error fetching nutrition entries:', nutritionRes.error)

  const trainers = (trainersRes.data ?? []) as TrainerRow[]
  const workouts = (workoutsRes.data ?? []) as WorkoutRow[]
  const tasks = (tasksRes.data ?? []) as TaskRow[]
  const checkins = (checkinsRes.data ?? []) as CheckinAssignmentRow[]
  const meals = (mealsRes.data ?? []) as MealRow[]
  const nutritionDays = (nutritionRes.data ?? []) as NutritionRow[]
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

  const mealsByPerson = new Map<string, MealRow[]>()
  for (const meal of meals) {
    const list = mealsByPerson.get(meal.person_id) ?? []
    list.push(meal)
    mealsByPerson.set(meal.person_id, list)
  }

  const nutritionByPerson = new Map<string, NutritionRow[]>()
  for (const entry of nutritionDays) {
    const list = nutritionByPerson.get(entry.client_id) ?? []
    list.push(entry)
    nutritionByPerson.set(entry.client_id, list)
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

    const compliance = calculateComplianceScore({
      workouts: workoutsByPerson.get(client.id) ?? [],
      sessions: sessionsByPerson.get(client.id) ?? [],
      checkins: personCheckins,
      habits: personTasks.filter((t) => t.kind === 'habit'),
      meals: mealsByPerson.get(client.id) ?? [],
      nutritionDays: nutritionByPerson.get(client.id) ?? [],
      payments: personPayments,
      overdueBills: nextBillPast && nextBillAt ? [{ due_date: nextBillAt }] : [],
    }, now)

    const converted = client.converted_at ? new Date(client.converted_at) : null
    const daysSinceConvert =
      converted && !Number.isNaN(converted.getTime())
        ? (now.getTime() - converted.getTime()) / 86400000
        : null
    const hasIncompleteIntake = personCheckins.some(
      (row) => row.purpose === 'intake' && row.status !== 'completed'
    )
    const derivedOnboarding =
      contract?.status === 'active' &&
      daysSinceConvert != null &&
      daysSinceConvert <= ONBOARDING_WINDOW_DAYS &&
      (!hasSucceededPayment || hasIncompleteIntake)
    const inOnboarding =
      client.onboarding_status != null
        ? personIsInOnboarding(client.onboarding_status)
        : derivedOnboarding
    const atRisk =
      status !== 'inactive' &&
      status !== 'paused' &&
      (
        flags.includes('payment_failed') ||
        flags.includes('past_due') ||
        flags.includes('checkin_overdue') ||
        (compliance.percent != null && compliance.percent < AT_RISK_COMPLIANCE_THRESHOLD)
      )

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
      compliance,
      complianceLabel: complianceTooltip(compliance),
      inOnboarding,
      atRisk,
    }
  })

  return mapped.sort((a, b) => {
    const byStatus = statusRank(a.status) - statusRank(b.status)
    if (byStatus !== 0) return byStatus
    return a.name.localeCompare(b.name)
  })
}
