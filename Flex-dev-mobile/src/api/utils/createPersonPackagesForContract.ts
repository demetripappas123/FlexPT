import { supabase } from '../supabase'
import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

/**
 * @deprecated Entitlements are created on payment via applyPaymentToPersonPackages.
 * Assigning a contract is only the billing agreement — do not call this from assign/convert flows.
 *
 * Historical: created pending person_packages rows (one per package service) on contract assign.
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
