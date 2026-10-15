import { supabaseAdmin } from '../supabaseAdmin'
import { validatePaymentAmountForContract } from '../utils/applyPaymentToPersonPackages'

function toDateOnly(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
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

type ContractRow = {
  id: string
  person_id: string | null
  trainer_id: string | null
  package_id: string | null
  pif: boolean | null
  pif_cost: number | null
  cost_per_bill_cycle: number | null
  bill_cycle_length_weeks: number | null
  payment_collector: string | null
}

/**
 * Insert a succeeded FlexPT (Stripe) payment and grant person_packages.
 * Idempotent on external_payment_id. Uses the service-role client (webhook has no user JWT).
 */
export async function recordFlexStripePayment(input: {
  contractId: string
  amount: number
  externalPaymentId: string
  processedAt?: string
}): Promise<{ paymentId: string; created: boolean }> {
  const existing = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('external_payment_id', input.externalPaymentId)
    .maybeSingle()

  if (existing.data?.id) {
    return { paymentId: String(existing.data.id), created: false }
  }

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('contracts')
    .select(
      'id, person_id, trainer_id, package_id, pif, pif_cost, cost_per_bill_cycle, bill_cycle_length_weeks, payment_collector'
    )
    .eq('id', input.contractId)
    .single()

  if (contractError || !contract) {
    throw new Error(`Contract ${input.contractId} not found`)
  }

  const row = contract as ContractRow
  if (row.payment_collector === 'organization') {
    throw new Error('This contract is organization-billed; record the payment in FlexPT instead of Stripe')
  }
  if (!row.person_id) throw new Error('Contract has no person')
  if (!row.package_id) throw new Error('Contract has no package')

  const cycleCost = row.pif
    ? Number(row.pif_cost)
    : Number(row.cost_per_bill_cycle) > 0
      ? Number(row.cost_per_bill_cycle)
      : null

  const validation = validatePaymentAmountForContract(
    input.amount,
    row.pif,
    row.pif_cost,
    cycleCost
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const processedAt = input.processedAt ?? new Date().toISOString()
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert([
      {
        contract_id: row.id,
        trainer_id: row.trainer_id,
        amount: input.amount,
        currency: 'USD',
        status: 'succeeded',
        payment_type: row.pif ? 'PIF' : 'recurring',
        external_payment_id: input.externalPaymentId,
        processed_at: processedAt,
        generated_obligations: true,
      },
    ])
    .select('id')
    .single()

  if (paymentError) {
    if (paymentError.code === '23505') {
      const again = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('external_payment_id', input.externalPaymentId)
        .maybeSingle()
      if (again.data?.id) return { paymentId: String(again.data.id), created: false }
    }
    throw paymentError
  }

  const paymentId = String(payment.id)
  const { data: packageServices, error: servicesError } = await supabaseAdmin
    .from('package_services')
    .select('*')
    .eq('package_id', row.package_id)

  if (servicesError) throw servicesError
  if (!packageServices?.length) {
    throw new Error("This contract's package has no services")
  }

  const isPif = Boolean(row.pif)
  const cycles = cycleCountForPayment(input.amount, row.pif, cycleCost)
  const billWeeks = Math.max(1, Number(row.bill_cycle_length_weeks) || 1)
  let cycleStart = toDateOnly(processedAt)

  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
    for (const ps of packageServices) {
      const unitsGranted = Number(ps.units_per_bill_cycle ?? ps.units_per_obligation_cycle)
      const cycleWeeks =
        Number(ps.package_bill_cycle_weeks ?? ps.obligation_cycle_length_weeks) || billWeeks
      const { data: created, error: ppError } = await supabaseAdmin
        .from('person_packages')
        .insert([
          {
            person_id: row.person_id,
            package_id: row.package_id,
            service_id: ps.service_id,
            unit_cost: ps.unit_cost ?? null,
            is_included: ps.is_included ?? true,
            units_per_obligation_cycle: Number.isFinite(unitsGranted) ? unitsGranted : null,
            obligation_cycle_length_weeks: cycleWeeks,
            trainer_id: row.trainer_id,
            contract_id: row.id,
            payment_id: paymentId,
            payment_date: cycleStart,
            next_payment_date: isPif ? null : addWeeks(cycleStart, cycleWeeks),
            status: 'paid',
          },
        ])
        .select('id')
        .single()
      if (ppError) throw ppError
      if (created?.id) {
        await supabaseAdmin.rpc('sync_open_tasks_for_person_package', { pp_id: created.id })
      }
    }
    if (cycleIndex < cycles - 1) {
      cycleStart = addWeeks(cycleStart, billWeeks)
    }
  }

  return { paymentId, created: true }
}
