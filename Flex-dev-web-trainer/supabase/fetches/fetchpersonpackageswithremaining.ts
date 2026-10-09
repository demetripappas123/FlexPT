import { supabase } from '../supabaseClient'
import { fetchPersonPackagesByPersonId, PersonPackage } from './fetchpersonpackages'
import { fetchServices, Service } from './fetchservices'

export interface PersonPackageWithRemaining extends PersonPackage {
  remaining_units: number
  total_units: number
  used_units: number
  service_name: string | null
  service_type: string | null
}

/** Sessions that still consume an entitlement unit. */
export function sessionConsumesEntitlement(status: string | null | undefined): boolean {
  return status !== 'canceled_no_charge'
}

export function remainingFromGranted(granted: number | null | undefined, used: number): number {
  const total = Number(granted) || 0
  return Math.max(0, total - used)
}

export async function countUsedUnitsByPersonPackageIds(
  personPackageIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of personPackageIds) counts[id] = 0
  if (personPackageIds.length === 0) return counts

  const { data, error } = await supabase
    .from('sessions')
    .select('person_package_id, status')
    .in('person_package_id', personPackageIds)

  if (error) {
    console.error('Error counting sessions for entitlements:', error)
    throw error
  }

  for (const row of data ?? []) {
    if (!row.person_package_id) continue
    if (!sessionConsumesEntitlement(row.status)) continue
    counts[row.person_package_id] = (counts[row.person_package_id] ?? 0) + 1
  }

  return counts
}

export async function attachRemainingToPersonPackages(
  rows: PersonPackage[],
  services?: Service[]
): Promise<PersonPackageWithRemaining[]> {
  const serviceList = services ?? (await fetchServices())
  const serviceMap = new Map(serviceList.map((s) => [s.id, s]))
  const usedById = await countUsedUnitsByPersonPackageIds(rows.map((r) => r.id))

  return rows.map((row) => {
    const service = serviceMap.get(row.service_id)
    const total = Number(row.units_per_obligation_cycle) || 0
    const used = usedById[row.id] ?? 0
    return {
      ...row,
      total_units: total,
      used_units: used,
      remaining_units: remainingFromGranted(total, used),
      service_name: service?.name ?? null,
      service_type: service?.service_type ?? null,
    }
  })
}

/**
 * Fetch person_packages for a person with remaining session units.
 * Remaining is granted units minus scheduled/completed sessions (except canceled_no_charge).
 */
export async function fetchPersonPackagesWithRemaining(
  personId: string,
  options?: {
    serviceType?: string
    onlyWithRemaining?: boolean
    paidOnly?: boolean
  }
): Promise<PersonPackageWithRemaining[]> {
  const personPackages = await fetchPersonPackagesByPersonId(personId)
  const withRemaining = await attachRemainingToPersonPackages(personPackages)

  return withRemaining.filter((pp) => {
    if (options?.paidOnly !== false && pp.status !== 'paid') return false
    if (options?.serviceType && pp.service_type !== options.serviceType) return false
    if (options?.onlyWithRemaining && pp.remaining_units <= 0) return false
    return true
  })
}
