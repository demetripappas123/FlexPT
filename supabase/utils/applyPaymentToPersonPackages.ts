import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPersonPackagesByPersonId } from '../fetches/fetchpersonpackages'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

const AMOUNT_TOLERANCE = 0.01

/**
 * Validates payment amount for a package: PIF must equal pif_cost; recurring must be a multiple of default_cost_per_cycle.
 * Returns { valid: boolean, error?: string }.
 */
export function validatePaymentAmountForPackage(
  amount: number,
  pif: boolean,
  pifCost: number | null,
  defaultCostPerCycle: number | null
): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' }
  }
  if (pif) {
    const cost = Number(pifCost)
    if (pifCost == null || isNaN(cost) || cost <= 0) {
      return { valid: false, error: 'This package has no PIF cost set' }
    }
    if (Math.abs(amount - cost) > AMOUNT_TOLERANCE) {
      return { valid: false, error: `PIF payment must equal $${cost.toFixed(2)}` }
    }
    return { valid: true }
  }
  const cycleCost = Number(defaultCostPerCycle)
  if (defaultCostPerCycle == null || isNaN(cycleCost) || cycleCost <= 0) {
    return { valid: false, error: 'This package has no recurring cycle cost set' }
  }
  const cycles = amount / cycleCost
  if (Math.abs(cycles - Math.round(cycles)) > AMOUNT_TOLERANCE / cycleCost || cycles < 1) {
    return { valid: false, error: `Recurring payment must be a multiple of $${cycleCost.toFixed(2)} (e.g. $${cycleCost.toFixed(2)}, $${(cycleCost * 2).toFixed(2)})` }
  }
  return { valid: true }
}

/**
 * Applies a payment to person_packages: validates amount, then marks the right pending rows as 'paid'.
 * - PIF: amount must equal pif_cost; marks all pending obligation cycles for that package (activates all).
 * - Recurring: amount must be a multiple of default_cost_per_cycle; marks that many cycles in advance (by start_date order).
 * Returns the first person_package id that was marked (for linking to the payment record).
 */
export async function applyPaymentToPersonPackages(
  personId: string,
  packageId: string,
  amount: number
): Promise<string> {
  const pkg = await fetchPackageById(packageId)
  if (!pkg) {
    throw new Error(`Package ${packageId} not found`)
  }

  const validation = validatePaymentAmountForPackage(
    amount,
    pkg.pif,
    pkg.pif_cost,
    pkg.default_cost_per_cycle
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const allForPerson = await fetchPersonPackagesByPersonId(personId)
  const pending = allForPerson.filter(
    (pp) => pp.package_id === packageId && pp.status === 'pending'
  )
  if (pending.length === 0) {
    throw new Error('No pending billing cycles found for this package')
  }

  let toMark: typeof pending
  if (pkg.pif) {
    toMark = pending
  } else {
    const cycleCost = Number(pkg.default_cost_per_cycle) || 0
    const numCycles = Math.round(amount / cycleCost)
    const uniqueStartDates = [...new Set(pending.map((pp) => pp.start_date))].sort()
    const cycleStartDates = uniqueStartDates.slice(0, numCycles)
    toMark = pending.filter((pp) => cycleStartDates.includes(pp.start_date))
  }

  if (toMark.length === 0) {
    throw new Error('No matching pending cycles to mark as paid')
  }

  const firstId = toMark[0].id
  for (const pp of toMark) {
    await upsertPersonPackage({
      id: pp.id,
      person_id: pp.person_id,
      package_id: pp.package_id,
      service_id: pp.service_id,
      unit_cost: pp.unit_cost ?? null,
      is_included: pp.is_included ?? true,
      units_per_obligation_cycle: pp.units_per_obligation_cycle,
      obligation_cycle_length_weeks: pp.obligation_cycle_length_weeks,
      trainer_id: pp.trainer_id ?? null,
      start_date: pp.start_date,
      end_date: pp.end_date,
      status: 'paid',
    })
  }

  return firstId
}
