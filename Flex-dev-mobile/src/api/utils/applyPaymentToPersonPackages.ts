import { fetchContractById } from '../fetches/fetchcontracts'
import { fetchPackageServicesByPackageId } from '../fetches/fetchpackageservices'
import { fetchPersonPackagesByPersonId } from '../fetches/fetchpersonpackages'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'
import { resolveContractCycleCost } from './packageCycleCost'
import { syncOpenTasksForPersonPackage } from '../fetches/fetchtasks'

const AMOUNT_TOLERANCE = 0.01

/**
 * Validates payment amount for a contract: PIF must equal pif_cost;
 * recurring must be a multiple of cost_per_bill_cycle.
 */
export function validatePaymentAmountForContract(
  amount: number,
  pif: boolean | null,
  pifCost: number | null,
  costPerBillCycle: number | null
): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' }
  }
  if (pif) {
    const cost = Number(pifCost)
    if (pifCost == null || isNaN(cost) || cost <= 0) {
      return { valid: false, error: 'This contract has no PIF cost set' }
    }
    if (Math.abs(amount - cost) > AMOUNT_TOLERANCE) {
      return { valid: false, error: `PIF payment must equal $${cost.toFixed(2)}` }
    }
    return { valid: true }
  }
  const cycleCost = Number(costPerBillCycle)
  if (costPerBillCycle == null || isNaN(cycleCost) || cycleCost <= 0) {
    return { valid: false, error: 'This contract has no recurring cycle cost set' }
  }
  const cycles = amount / cycleCost
  if (Math.abs(cycles - Math.round(cycles)) > AMOUNT_TOLERANCE / cycleCost || cycles < 1) {
    return {
      valid: false,
      error: `Recurring payment must be a multiple of $${cycleCost.toFixed(2)} (e.g. $${cycleCost.toFixed(2)}, $${(cycleCost * 2).toFixed(2)})`,
    }
  }
  return { valid: true }
}

/** @deprecated Use validatePaymentAmountForContract */
export const validatePaymentAmountForPackage = validatePaymentAmountForContract

function toDateOnly(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addWeeks(dateStr: string, weeks: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + weeks * 7)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function cycleCountForPayment(
  amount: number,
  pif: boolean | null,
  costPerBillCycle: number | null
): number {
  if (pif) return 1
  const cycleCost = Number(costPerBillCycle)
  return Math.max(1, Math.round(amount / cycleCost))
}

/**
 * Creates paid person_packages entitlement rows from the contract's package_services.
 * Recurring amounts that are N × cycle cost insert N sequential cycles.
 * Idempotent when paymentId already has person_packages rows.
 * Returns the first created (or existing) person_package id.
 */
export async function applyPaymentToPersonPackages(
  personId: string,
  contractId: string,
  amount: number,
  paymentId?: string | null,
  paymentDate?: string | null
): Promise<string> {
  const contract = await fetchContractById(contractId)
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`)
  }
  if (!contract.package_id) {
    throw new Error('This contract has no package template')
  }

  const cycleCost = contract.pif
    ? contract.cost_per_bill_cycle
    : await resolveContractCycleCost(contract)

  const validation = validatePaymentAmountForContract(
    amount,
    contract.pif,
    contract.pif_cost,
    cycleCost
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  if (paymentId) {
    const existing = (await fetchPersonPackagesByPersonId(personId)).filter(
      (pp) => pp.payment_id === paymentId
    )
    if (existing.length > 0) {
      await Promise.all(existing.map((pp) => syncOpenTasksForPersonPackage(pp.id)))
      return existing[0].id
    }
  }

  const packageServices = await fetchPackageServicesByPackageId(contract.package_id)
  if (!packageServices.length) {
    throw new Error("This contract's package has no services. Add services to the package first.")
  }

  const isPif = Boolean(contract.pif)
  const cycles = cycleCountForPayment(amount, contract.pif, cycleCost)
  const billWeeks = Math.max(1, Number(contract.bill_cycle_length_weeks) || 1)
  let cycleStart = toDateOnly(paymentDate || new Date().toISOString())
  let firstId: string | null = null
  const createdIds: string[] = []

  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
    for (const ps of packageServices) {
      const unitsGranted = Number(
        (ps as { units_per_bill_cycle?: number }).units_per_bill_cycle ??
          ps.units_per_obligation_cycle
      )
      const cycleWeeks =
        Number(
          (ps as { package_bill_cycle_weeks?: number }).package_bill_cycle_weeks ??
            ps.obligation_cycle_length_weeks
        ) || billWeeks
      const created = await upsertPersonPackage({
        person_id: personId,
        package_id: contract.package_id,
        service_id: ps.service_id,
        unit_cost: ps.unit_cost ?? null,
        is_included: ps.is_included ?? true,
        units_per_obligation_cycle: Number.isFinite(unitsGranted) ? unitsGranted : null,
        obligation_cycle_length_weeks: cycleWeeks,
        trainer_id: contract.trainer_id,
        contract_id: contractId,
        payment_id: paymentId ?? null,
        payment_date: cycleStart,
        next_payment_date: isPif ? null : addWeeks(cycleStart, cycleWeeks),
        status: 'paid',
      })
      const createdId =
        created && typeof created === 'object' && 'id' in created
          ? String((created as { id: unknown }).id)
          : null
      if (!firstId && createdId) firstId = createdId
      if (createdId) createdIds.push(createdId)
    }
    if (cycleIndex < cycles - 1) {
      cycleStart = addWeeks(cycleStart, billWeeks)
    }
  }

  if (!firstId) {
    throw new Error('Failed to create entitlements for this payment')
  }
  await Promise.all(createdIds.map((id) => syncOpenTasksForPersonPackage(id)))
  return firstId
}
