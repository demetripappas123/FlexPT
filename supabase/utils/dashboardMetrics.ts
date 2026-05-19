import { Session, SessionType } from '../fetches/fetchsessions'
import { PersonPackage } from '../fetches/fetchpersonpackages'

/** Prospect / non-client session types (aligned with fetchsessions SessionType). */
export const PROSPECT_SESSION_TYPES: SessionType[] = [
  'Prospect Session',
  'Intro Session',
  'Followup Session',
]

export function isProspectSessionType(type: string): boolean {
  return PROSPECT_SESSION_TYPES.includes(type as SessionType)
}

export function getSessionDateForMetrics(session: Session): Date | null {
  if (session.started_at) return new Date(session.started_at)
  if (session.end_time) return new Date(session.end_time)
  return null
}

/** Duration in hours from actual timestamps, or fallback (default 1h). */
export function getSessionDurationHours(session: Session, fallbackHours = 1): number {
  if (session.started_at && session.end_time) {
    const ms = new Date(session.end_time).getTime() - new Date(session.started_at).getTime()
    if (ms > 0) return ms / (1000 * 60 * 60)
  }
  return fallbackHours
}

/**
 * Per-session trained revenue from person_packages (post-refactor pricing lives here).
 */
export function getTrainedRevenueForSession(personPackage: PersonPackage | undefined): number {
  if (!personPackage) return 0
  const unitCost = Number(personPackage.unit_cost)
  if (isNaN(unitCost) || unitCost <= 0) return 0
  return unitCost
}

/** Unique billing-cycle start dates for person_packages of a given package. */
export function uniqueCycleStartDates(
  rows: PersonPackage[],
  packageId: string,
  statusFilter?: string
): string[] {
  const dates = rows
    .filter((pp) => pp.package_id === packageId && (!statusFilter || pp.status === statusFilter))
    .map((pp) => pp.start_date)
  return [...new Set(dates)].sort()
}

export function personPackagesOverlapRange(
  pp: PersonPackage,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const ppStart = new Date(pp.start_date)
  const ppEnd = new Date(pp.end_date)
  return ppStart <= rangeEnd && ppEnd >= rangeStart
}
