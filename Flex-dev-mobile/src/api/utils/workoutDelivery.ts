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
}): string {
  const delivery = workoutDelivery(workout)
  const sessionAccent = delivery === 'session' ? 'border-l-4 border-l-violet-500' : 'border-l-4 border-l-slate-400'
  if (workout.completed) {
    return `border-emerald-500/40 bg-emerald-500/5 ${sessionAccent}`
  }
  if (delivery === 'session') {
    return `border-violet-500/50 bg-violet-500/10 ${sessionAccent}`
  }
  return `border-orange-500/40 bg-orange-500/5 ${sessionAccent}`
}

export function workoutCalendarChipClass(workout: {
  delivery?: WorkoutDelivery | string | null
  session?: { status?: string | null } | null
  completed?: boolean
}): string {
  if (workout.completed) {
    return 'bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30'
  }
  if (workoutDelivery(workout) === 'session') {
    return 'bg-violet-600/20 border border-violet-600/50 text-violet-300 hover:bg-violet-600/30'
  }
  return 'bg-orange-600/20 border border-orange-600/50 text-orange-400 hover:bg-orange-600/30'
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
