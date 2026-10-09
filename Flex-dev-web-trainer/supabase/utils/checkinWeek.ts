/** Monday-start week, matching workout/meal calendars. */

export function startOfWeekMonday(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

export function endOfWeekMonday(now = new Date()): Date {
  const end = startOfWeekMonday(now)
  end.setDate(end.getDate() + 7)
  return end
}

export function isInCurrentWeek(value: string | null | undefined, now = new Date()): boolean {
  if (!value) return false
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  const start = startOfWeekMonday(now).getTime()
  const end = endOfWeekMonday(now).getTime()
  return parsed.getTime() >= start && parsed.getTime() < end
}

export function assignmentCompletedThisWeek(assignment: {
  status: string
  assigned_date?: string | null
  completed_at?: string | null
}, now = new Date()): boolean {
  if (assignment.status !== 'completed') return false
  return isInCurrentWeek(assignment.completed_at, now) || isInCurrentWeek(assignment.assigned_date, now)
}
