import { supabase } from '../supabaseClient'
import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

/**
 * When assigning a contract (package to person), create person_packages rows with
 * status 'pending': one row per package service for the first obligation cycle.
 * Timeframe is expressed via next_payment_date (no start_date/end_date on person_packages).
 * Later cycles / payment linkage happen when payments are applied.
 */
export type CreatePersonPackagesForContractParams = {
  personId: string
  packageId: string
  trainerId: string | null
  contractId: string
  contractStartDate: string // YYYY-MM-DD or ISO
  /** When true, only the first obligation period is created. */
  untilCancelled?: boolean
}

function toDateOnly(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().split('T')[0]
}

export async function createPersonPackagesForContract(
  params: CreatePersonPackagesForContractParams
): Promise<void> {
  const { personId, packageId, trainerId, contractId, contractStartDate } = params

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

  // Idempotency: skip services that already have a pending row for this contract
  const { data: existingRows } = await supabase
    .from('person_packages')
    .select('service_id')
    .eq('person_id', personId)
    .eq('contract_id', contractId)
  const existingServices = new Set((existingRows ?? []).map((r) => r.service_id))

  const contractStart = new Date(contractStartDate)
  contractStart.setHours(0, 0, 0, 0)

  for (const ps of packageServices) {
    if (existingServices.has(ps.service_id)) continue

    const cycleWeeks = Number(ps.obligation_cycle_length_weeks) || 1
    const nextPayment = new Date(contractStart)
    nextPayment.setDate(nextPayment.getDate() + cycleWeeks * 7)

    await upsertPersonPackage({
      person_id: personId,
      package_id: packageId,
      service_id: ps.service_id,
      unit_cost: ps.unit_cost ?? null,
      is_included: ps.is_included ?? true,
      units_per_obligation_cycle: ps.units_per_obligation_cycle,
      obligation_cycle_length_weeks: cycleWeeks,
      trainer_id: trainerId,
      contract_id: contractId,
      payment_date: null,
      next_payment_date: toDateOnly(nextPayment.toISOString()),
      status: 'pending',
    })
  }
}
