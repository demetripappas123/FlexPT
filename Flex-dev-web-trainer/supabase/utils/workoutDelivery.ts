export type WorkoutDelivery = 'session' | 'solo'

export function isActiveSession(session?: { status?: string | null } | null): boolean {
  if (!session) return false
  return session.status !== 'canceled_with_charge' && session.status !== 'canceled_no_charge'
}

export function workoutDelivery(workout: {
  delivery?: WorkoutDelivery | string | null
  session?: { status?: string | null } | null
}): WorkoutDelivery {
  if (workout.delivery === 'session' || workout.delivery === 'solo') return workout.delivery
  return isActiveSession(workout.session) ? 'session' : 'solo'
}

export function workoutHasBookedSession(workout: {
  session?: { status?: string | null } | null
}): boolean {
  return isActiveSession(workout.session)
}

export function canScheduleSessionOnWorkout(workout: {
  session?: { status?: string | null } | null
}): boolean {
  return !workoutHasBookedSession(workout)
}

export function workoutDeliveryCardClass(workout: {
  delivery?: WorkoutDelivery | string | null
  session?: { status?: string | null } | null
  completed?: boolean
  workout_date?: string | null
}): string {
  if (isSoloWorkoutOverdue(workout)) {
    return 'border-destructive/40 bg-destructive/10'
  }
  if (workout.completed) {
    return 'border-border bg-card'
  }
  return 'border-border bg-secondary/40'
}

export function workoutCalendarChipClass(workout: {
  delivery?: WorkoutDelivery | string | null
  session?: { status?: string | null } | null
  completed?: boolean
  workout_date?: string | null
}): string {
  if (isSoloWorkoutOverdue(workout)) {
    return 'bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/20'
  }
  if (workout.completed) {
    return 'bg-secondary border border-border text-foreground hover:bg-secondary/80'
  }
  if (workoutDelivery(workout) === 'session') {
    return 'bg-foreground text-background hover:bg-foreground/90'
  }
  return 'bg-card border border-border text-foreground hover:bg-muted'
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.slice(0, 10).match(/^(\d{4}-\d{2}-\d{2})$/)
  return match ? match[1] : null
}

function todayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Solo workout whose assigned day is before today and is still incomplete. */
export function isSoloWorkoutOverdue(workout: {
  delivery?: WorkoutDelivery | string | null
  completed?: boolean | null
  workout_date?: string | null
}, now: Date = new Date()): boolean {
  if (workout.completed) return false
  if (workout.delivery !== 'solo') return false
  const due = dateKey(workout.workout_date)
  if (!due) return false
  return due < todayKey(now)
}

export function workoutDeliveryLabel(workout: {
  delivery?: WorkoutDelivery | string | null
  session?: { status?: string | null; start_time?: string | null } | null
}): string {
  const delivery = workoutDelivery(workout)
  if (workoutHasBookedSession(workout)) {
    const start = workout.session?.start_time
    if (start) {
      const when = new Date(start)
      if (!Number.isNaN(when.getTime())) {
        return `Session · ${when.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      }
    }
    return 'Session booked'
  }
  return delivery === 'session' ? 'Session' : 'Solo'
}
