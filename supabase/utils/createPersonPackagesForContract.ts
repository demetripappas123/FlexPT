import { supabase } from '../supabaseClient'
import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

/**
 * When assigning a contract (package to person), create person_packages rows with
 * status 'pending': one row per package service per obligation cycle.
 * - PIF / recurring with fixed duration: create all cycles for the full duration.
 * - Recurring infinite ("until cancelled"): create only the first period (one row per
 *   package service). All later periods are created only by the cron job, one period
 *   per run when the previous period's end_date is reached.
 */
export type CreatePersonPackagesForContractParams = {
  personId: string
  packageId: string
  trainerId: string | null
  contractStartDate: string // YYYY-MM-DD or ISO
  /** For fixed-duration contracts, number of months to generate cycles for. Ignored when untilCancelled is true. */
  durationMonths: number
  /** When true, only the first obligation period is created; cron creates subsequent periods. */
  untilCancelled?: boolean
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
  const { personId, packageId, trainerId, contractStartDate, durationMonths, untilCancelled } = params

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

  // Idempotency: skip creating rows that already exist (same person, package, service, start_date)
  const { data: existingRows } = await supabase
    .from('person_packages')
    .select('service_id, start_date')
    .eq('person_id', personId)
    .eq('package_id', packageId)
  const existingKeys = new Set(
    (existingRows ?? []).map((r) => `${r.service_id}|${r.start_date}`)
  )

  const contractStart = new Date(contractStartDate)
  contractStart.setHours(0, 0, 0, 0)
  const contractDurationWeeks = untilCancelled ? 0 : durationMonths * WEEKS_PER_MONTH

  for (const ps of packageServices) {
    const cycleWeeks = Number(ps.obligation_cycle_length_weeks) || 1
    // Recurring infinite: exactly one period here; cron creates each subsequent period when its start (previous end_date) is reached
    const numCycles = untilCancelled ? 1 : Math.max(0, Math.floor(contractDurationWeeks / cycleWeeks))
    const cycleDays = cycleWeeks * 7

    for (let i = 0; i < numCycles; i++) {
      const cycleStart = new Date(contractStart)
      cycleStart.setDate(cycleStart.getDate() + i * cycleDays)
      const cycleEnd = new Date(cycleStart)
      cycleEnd.setDate(cycleEnd.getDate() + cycleDays)

      const startDateStr = toDateOnly(cycleStart.toISOString())
      if (existingKeys.has(`${ps.service_id}|${startDateStr}`)) continue

      await upsertPersonPackage({
        person_id: personId,
        package_id: packageId,
        service_id: ps.service_id,
        unit_cost: ps.unit_cost ?? null,
        is_included: ps.is_included ?? true,
        units_per_obligation_cycle: ps.units_per_obligation_cycle,
        obligation_cycle_length_weeks: cycleWeeks,
        trainer_id: trainerId,
        start_date: startDateStr,
        end_date: toDateOnly(cycleEnd.toISOString()),
        status: 'pending',
      })
      existingKeys.add(`${ps.service_id}|${startDateStr}`)
    }
  }
}
