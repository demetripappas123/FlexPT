import { supabase } from '../supabaseClient'
import {
  Payment,
  PAYMENT_ORDER_COLUMN,
  PAYMENT_SELECT_COLUMNS,
  mapPaymentRow,
  getPaymentTimestamp,
  isPaymentCountedForRevenue,
} from './paymentSchema'

export type { Payment }
export { isPaymentCountedForRevenue, getPaymentTimestamp } from './paymentSchema'

function paymentsQuery() {
  return supabase.from('payments').select(PAYMENT_SELECT_COLUMNS)
}

function mapRows(data: unknown[] | null): Payment[] {
  return (data ?? []).map((row) => mapPaymentRow(row as Record<string, unknown>))
}

/**
 * Fetch payments for a person via their contracts.
 */
export async function fetchPaymentsByPersonId(personId: string): Promise<Payment[]> {
  const { data: contracts, error: contractErr } = await supabase
    .from('contracts')
    .select('id')
    .eq('person_id', personId)

  if (contractErr) {
    console.error('Error fetching contracts for payments:', contractErr)
    return []
  }

  if (!contracts?.length) return []

  const contractIds = contracts.map((c) => c.id)

  const { data, error } = await paymentsQuery()
    .in('contract_id', contractIds)
    .order(PAYMENT_ORDER_COLUMN, { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error fetching payments by contract:', error)
    return []
  }

  return mapRows(data)
}

/**
 * Fetch all payments, optionally filtered by trainer_id.
 */
export async function fetchPayments(trainerId?: string | null): Promise<Payment[]> {
  let query = paymentsQuery().order(PAYMENT_ORDER_COLUMN, { ascending: false, nullsFirst: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching payments:', error)
    return []
  }

  return mapRows(data)
}

/**
 * Sum payment amounts in a date range (processed/completed payments only).
 */
export async function sumPaymentsInDateRange(
  startDate: Date,
  endDate: Date,
  trainerId?: string | null
): Promise<number> {
  const payments = trainerId ? await fetchPayments(trainerId) : await fetchPayments()

  return payments
    .filter((p) => {
      if (!isPaymentCountedForRevenue(p)) return false
      const t = getPaymentTimestamp(p)
      return t >= startDate.getTime() && t <= endDate.getTime()
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

export async function fetchPaymentsByContract(contractId: string): Promise<Payment[]> {
  const { data, error } = await paymentsQuery()
    .eq('contract_id', contractId)
    .order(PAYMENT_ORDER_COLUMN, { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error fetching payments by contract:', error)
    return []
  }

  return mapRows(data)
}

/** @deprecated Use fetchPaymentsByContract */
export const fetchPaymentsByPersonPackage = fetchPaymentsByContract

export async function fetchPaymentById(paymentId: string): Promise<Payment | null> {
  const { data, error } = await paymentsQuery().eq('id', paymentId).single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching payment:', error)
    return null
  }

  return data ? mapPaymentRow(data as Record<string, unknown>) : null
}
