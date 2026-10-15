export const COMPLIANCE_WINDOW_DAYS = 28

export const COMPLIANCE_WEIGHTS = {
  workout: 100,
  macros: 100,
  session: 100,
  payment: 100,
  checkin: 30,
  habit: 30,
  meal: 30,
} as const

export type ComplianceKind = keyof typeof COMPLIANCE_WEIGHTS

export type ComplianceItem = {
  kind: ComplianceKind
  date: string
  expected: number
  earned: number
}

export type ComplianceBreakdown = Record<ComplianceKind, { expected: number; earned: number; count: number; done: number }>

export type ComplianceScore = {
  percent: number | null
  expected: number
  earned: number
  breakdown: ComplianceBreakdown
  windowDays: number
}

export type ComplianceInputs = {
  workouts: Array<{ completed: boolean | null; workout_date?: string | null; created_at?: string | null }>
  sessions: Array<{
    type?: string | null
    status?: string | null
    missed?: string | null
    start_time?: string | null
    end_time?: string | null
  }>
  checkins: Array<{ status?: string | null; assigned_date?: string | null }>
  habits: Array<{ status?: string | null; due_date?: string | null; completed_at?: string | null }>
  meals: Array<{ status?: string | null; assigned_date?: string | null }>
  nutritionDays: Array<{ entry_date?: string | null; calories?: number | null; extra_calories?: number | null }>
  payments?: Array<{ status?: string | null; payment_date?: string | null }>
  overdueBills?: Array<{ due_date?: string | null }>
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const key = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null
}

function emptyBreakdown(): ComplianceBreakdown {
  return {
    workout: { expected: 0, earned: 0, count: 0, done: 0 },
    macros: { expected: 0, earned: 0, count: 0, done: 0 },
    session: { expected: 0, earned: 0, count: 0, done: 0 },
    payment: { expected: 0, earned: 0, count: 0, done: 0 },
    checkin: { expected: 0, earned: 0, count: 0, done: 0 },
    habit: { expected: 0, earned: 0, count: 0, done: 0 },
    meal: { expected: 0, earned: 0, count: 0, done: 0 },
  }
}

function addItem(items: ComplianceItem[], kind: ComplianceKind, date: string, done: boolean) {
  const weight = COMPLIANCE_WEIGHTS[kind]
  items.push({ kind, date, expected: weight, earned: done ? weight : 0 })
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function complianceWindow(now = new Date()): { start: string; end: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - (COMPLIANCE_WINDOW_DAYS - 1))
  return { start: localDateKey(start), end: localDateKey(end) }
}

function inWindow(date: string, start: string, end: string) {
  return date >= start && date <= end
}

function macrosLogged(row: { calories?: number | null; extra_calories?: number | null }) {
  return (Number(row.calories) || 0) > 0 || (Number(row.extra_calories) || 0) > 0
}

/**
 * Weighted engagement score for the last 28 due items.
 * Only past assignments count. Missing expected work is 0; future work is ignored.
 */
export function calculateComplianceScore(input: ComplianceInputs, now = new Date()): ComplianceScore {
  const { start, end } = complianceWindow(now)
  const items: ComplianceItem[] = []

  for (const workout of input.workouts) {
    const date = dateKey(workout.workout_date) ?? dateKey(workout.created_at)
    if (!date || !inWindow(date, start, end)) continue
    addItem(items, 'workout', date, workout.completed === true)
  }

  for (const session of input.sessions) {
    const date = dateKey(session.start_time) ?? dateKey(session.end_time)
    if (!date || !inWindow(date, start, end)) continue
    if (session.missed === 'missed' || session.missed === 'suggested') {
      addItem(items, 'session', date, false)
      continue
    }
    if (session.type === 'Client Session' && session.status === 'completed') {
      addItem(items, 'session', date, true)
    }
  }

  for (const checkin of input.checkins) {
    const date = dateKey(checkin.assigned_date)
    if (!date || !inWindow(date, start, end)) continue
    addItem(items, 'checkin', date, checkin.status === 'completed')
  }

  for (const habit of input.habits) {
    const date = dateKey(habit.due_date) ?? dateKey(habit.completed_at)
    if (!date || !inWindow(date, start, end)) continue
    addItem(items, 'habit', date, habit.status === 'done')
  }

  const mealDates = new Set<string>()
  const completedMealDates = new Set<string>()
  for (const meal of input.meals) {
    const date = dateKey(meal.assigned_date)
    if (!date || !inWindow(date, start, end)) continue
    mealDates.add(date)
    const done = meal.status === 'completed'
    if (done) completedMealDates.add(date)
    addItem(items, 'meal', date, done)
  }

  const loggedDays = new Set(
    input.nutritionDays
      .filter(macrosLogged)
      .map((row) => dateKey(row.entry_date))
      .filter((date): date is string => Boolean(date))
  )
  for (const date of mealDates) {
    addItem(items, 'macros', date, loggedDays.has(date) || completedMealDates.has(date))
  }

  const missedPaymentDates = new Set<string>()
  for (const payment of input.payments ?? []) {
    const status = (payment.status ?? '').toLowerCase()
    if (status !== 'failed' && status !== 'past_due') continue
    const date = dateKey(payment.payment_date)
    if (!date || !inWindow(date, start, end)) continue
    missedPaymentDates.add(date)
    addItem(items, 'payment', date, false)
  }
  for (const bill of input.overdueBills ?? []) {
    const date = dateKey(bill.due_date)
    if (!date || date > end) continue
    if (missedPaymentDates.has(date)) continue
    addItem(items, 'payment', date, false)
  }

  const breakdown = emptyBreakdown()
  let expected = 0
  let earned = 0
  for (const item of items) {
    expected += item.expected
    earned += item.earned
    const bucket = breakdown[item.kind]
    bucket.expected += item.expected
    bucket.earned += item.earned
    bucket.count += 1
    if (item.earned > 0) bucket.done += 1
  }

  return {
    percent: expected === 0 ? null : Math.round((earned / expected) * 100),
    expected,
    earned,
    breakdown,
    windowDays: COMPLIANCE_WINDOW_DAYS,
  }
}

export function complianceTooltip(score: ComplianceScore): string {
  if (score.percent == null) return 'No due workouts, meals, forms, sessions, or payments in the last 28 days'
  const parts = (Object.entries(score.breakdown) as [ComplianceKind, ComplianceBreakdown[ComplianceKind]][])
    .filter(([, bucket]) => bucket.count > 0)
    .map(([kind, bucket]) => `${kind} ${bucket.done}/${bucket.count}`)
  return `${score.percent}% over ${score.windowDays} days · ${parts.join(' · ')}`
}
