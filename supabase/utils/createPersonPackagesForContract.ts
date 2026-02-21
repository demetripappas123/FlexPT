import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

/**
 * When assigning a contract (package to person), create person_packages rows with
 * status 'payment pending': one row per package service per obligation cycle.
 * For PIF, total periods come from duration and obligation_cycle_length_weeks.
 */
export type CreatePersonPackagesForContractParams = {
  personId: string
  packageId: string
  trainerId: string | null
  contractStartDate: string // YYYY-MM-DD or ISO
  durationMonths: number
}

const WEEKS_PER_MONTH = 52 / 12

function toDateOnly(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().split('T')[0]
}

export async function createPersonPackagesForContract(
  params: CreatePersonPackagesForContractParams
): Promise<void> {
  const { personId, packageId, trainerId, contractStartDate, durationMonths } = params

  const [pkg, packageServices] = await Promise.all([
    fetchPackageById(packageId),
    fetchPackageServicesByPackageId(packageId),
  ])

  if (!pkg) {
    throw new Error(`Package ${packageId} not found`)
  }

  if (!packageServices || packageServices.length === 0) {
    return
  }

  const contractStart = new Date(contractStartDate)
  contractStart.setHours(0, 0, 0, 0)
  const contractDurationWeeks = durationMonths * WEEKS_PER_MONTH

  for (const ps of packageServices) {
    const cycleWeeks = Number(ps.obligation_cycle_length_weeks) || 1
    const numCycles = Math.max(0, Math.floor(contractDurationWeeks / cycleWeeks))
    const cycleDays = cycleWeeks * 7

    for (let i = 0; i < numCycles; i++) {
      const cycleStart = new Date(contractStart)
      cycleStart.setDate(cycleStart.getDate() + i * cycleDays)
      const cycleEnd = new Date(cycleStart)
      cycleEnd.setDate(cycleEnd.getDate() + cycleDays)

      await upsertPersonPackage({
        person_id: personId,
        package_id: packageId,
        service_id: ps.service_id,
        unit_cost: ps.unit_cost ?? null,
        is_included: ps.is_included ?? true,
        units_per_obligation_cycle: ps.units_per_obligation_cycle,
        obligation_cycle_length_weeks: cycleWeeks,
        trainer_id: trainerId,
        start_date: toDateOnly(cycleStart.toISOString()),
        end_date: toDateOnly(cycleEnd.toISOString()),
        status: 'pending',
      })
    }
  }
}
