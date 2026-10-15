import { fetchPackageServicesByPackageId, PackageService } from '../fetches/fetchpackageservices'

const WEEKLY_OPTIONS = [1, 2, 3] as const
export type SuggestedSessionsPerWeek = (typeof WEEKLY_OPTIONS)[number]

function isSessionService(service: { name?: string | null; service_type?: string | null } | undefined): boolean {
  const name = (service?.name || '').toLowerCase()
  const serviceType = (service?.service_type || '').toLowerCase()
  return name.includes('session') || serviceType.includes('session')
}

/** Snap package cadence onto the PIF 1× / 2× / 3× week choices. */
export function snapSuggestedSessionsPerWeek(raw: number): SuggestedSessionsPerWeek | null {
  if (!Number.isFinite(raw) || raw <= 0) return null
  const rounded = Math.round(raw)
  if (rounded <= 1) return 1
  if (rounded === 2) return 2
  return 3
}

export function suggestedSessionsPerWeekFromRows(
  rows: Array<
    PackageService & {
      service?: { name?: string | null; service_type?: string | null }
    }
  >
): SuggestedSessionsPerWeek | null {
  for (const row of rows) {
    if (!isSessionService(row.service)) continue
    const units = Number(row.units_per_bill_cycle ?? row.units_per_obligation_cycle) || 0
    const weeks = Math.max(1, Number(row.package_bill_cycle_weeks ?? row.obligation_cycle_length_weeks) || 1)
    if (units <= 0) continue
    return snapSuggestedSessionsPerWeek(units / weeks)
  }
  return null
}

export async function suggestedSessionsPerWeekForPackage(
  packageId: string
): Promise<SuggestedSessionsPerWeek | null> {
  const rows = await fetchPackageServicesByPackageId(packageId)
  return suggestedSessionsPerWeekFromRows(rows)
}

export function suggestedSessionsPerWeekLabel(n: number | null | undefined): string {
  if (n === 1) return 'Once a week'
  if (n === 2) return 'Twice a week'
  if (n === 3) return '3× a week'
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${n}× a week`
}
