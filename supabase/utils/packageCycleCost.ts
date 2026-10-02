import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { supabase } from '../supabaseClient'

function isSessionService(service: { name?: string | null; service_type?: string | null } | undefined): boolean {
  const name = (service?.name || '').toLowerCase()
  const serviceType = (service?.service_type || '').toLowerCase()
  return name.includes('session') || serviceType.includes('session')
}

/**
 * Recurring cost is not stored on packages. Derive it from package_services,
 * matching the package wizard: extra session units scaled to the billing cycle,
 * other extras added as a per-cycle lump.
 */
export async function calculatePackageCycleCost(
  packageId: string,
  billCycleWeeks?: number | null
): Promise<number> {
  const [pkg, rows] = await Promise.all([
    billCycleWeeks != null ? Promise.resolve(null) : fetchPackageById(packageId),
    fetchPackageServicesByPackageId(packageId),
  ])
  const cycleWeeks = Math.max(1, Number(billCycleWeeks ?? pkg?.bill_cycle_length_weeks) || 1)
  let total = 0

  for (const row of rows) {
    if (row.is_included) continue
    const unitCost = Number(row.unit_cost) || 0
    if (unitCost <= 0) continue

    if (isSessionService(row.service)) {
      const storedWeeks = Math.max(
        1,
        Number(row.package_bill_cycle_weeks ?? row.obligation_cycle_length_weeks) || 1
      )
      const storedUnits = Number(row.units_per_bill_cycle ?? row.units_per_obligation_cycle) || 0
      const unitsPerWeek = storedUnits / storedWeeks
      total += Math.round(unitsPerWeek * cycleWeeks) * unitCost
    } else {
      total += unitCost
    }
  }

  return total
}

/** Use the contract's stored cycle cost, or compute it from the linked package. */
export async function resolveContractCycleCost(contract: {
  id: string
  pif?: boolean | null
  cost_per_bill_cycle?: number | null
  bill_cycle_length_weeks?: number | null
  package_id?: string | null
}): Promise<number | null> {
  const stored = Number(contract.cost_per_bill_cycle)
  if (contract.cost_per_bill_cycle != null && !Number.isNaN(stored) && stored > 0) {
    return stored
  }
  if (contract.pif || !contract.package_id) return null

  const computed = await calculatePackageCycleCost(
    contract.package_id,
    contract.bill_cycle_length_weeks
  )
  if (computed <= 0) return null

  const { error } = await supabase
    .from('contracts')
    .update({ cost_per_bill_cycle: computed })
    .eq('id', contract.id)
  if (error) {
    console.error('Error backfilling contract cost_per_bill_cycle:', error)
  }

  return computed
}
