import { fetchContractById } from '../fetches/fetchcontracts'
import { fetchPersonPackagesByPersonId } from '../fetches/fetchpersonpackages'
import { upsertPersonPackage } from '../upserts/upsertpersonpackage'

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

/**
 * Applies a payment to person_packages for a contract: validates amount, then marks
 * pending rows as paid and links payment_id / payment_date.
 * Returns the first person_package id that was marked.
 */
export async function applyPaymentToPersonPackages(
  personId: string,
  contractId: string,
  amount: number,
  paymentId?: string | null
): Promise<string> {
  const contract = await fetchContractById(contractId)
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`)
  }

  const validation = validatePaymentAmountForContract(
    amount,
    contract.pif,
    contract.pif_cost,
    contract.cost_per_bill_cycle
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const allForPerson = await fetchPersonPackagesByPersonId(personId)
  const pending = allForPerson.filter(
    (pp) => pp.contract_id === contractId && pp.status === 'pending'
  )
  if (pending.length === 0) {
    throw new Error('No pending entitlements found for this contract')
  }

  const paymentDate = new Date().toISOString().split('T')[0]
  const firstId = pending[0].id

  for (const pp of pending) {
    const cycleWeeks = Number(pp.obligation_cycle_length_weeks) || 1
    const nextPayment = new Date(paymentDate)
    nextPayment.setDate(nextPayment.getDate() + cycleWeeks * 7)

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
      contract_id: pp.contract_id,
      payment_id: paymentId ?? pp.payment_id,
      payment_date: paymentDate,
      next_payment_date: nextPayment.toISOString().split('T')[0],
      status: 'paid',
    })
  }

  return firstId
}
