/**
 * payments table (public.payments) — contract-linked billing records.
 */

export interface Payment {
  id: string
  contract_id: string
  trainer_id: string | null
  amount: number
  currency: string
  status: string
  payment_type: string
  external_payment_id: string | null
  processed_at: string | null
  generated_obligations: boolean
  created_at: string | null
  updated_at: string | null
  failure_reason: string | null
  return_payment_or_no: boolean | null
  /** Display / dashboard: processed_at ?? created_at */
  payment_date: string
}

export const PAYMENT_SELECT_COLUMNS = [
  'id',
  'contract_id',
  'trainer_id',
  'amount',
  'currency',
  'status',
  'payment_type',
  'external_payment_id',
  'processed_at',
  'generated_obligations',
  'created_at',
  'updated_at',
  'failure_reason',
  'return_payment_or_no',
].join(', ')

export const PAYMENT_ORDER_COLUMN = 'processed_at'

export function mapPaymentRow(row: Record<string, unknown>): Payment {
  const processedAt = row.processed_at
  const createdAt = row.created_at
  const dateRaw = processedAt ?? createdAt
  const paymentDate =
    dateRaw instanceof Date
      ? dateRaw.toISOString()
      : typeof dateRaw === 'string'
        ? dateRaw
        : new Date().toISOString()

  return {
    id: String(row.id),
    contract_id: String(row.contract_id),
    trainer_id: row.trainer_id != null ? String(row.trainer_id) : null,
    amount: Number(row.amount) || 0,
    currency: row.currency != null ? String(row.currency) : 'USD',
    status: row.status != null ? String(row.status) : 'pending',
    payment_type: row.payment_type != null ? String(row.payment_type) : '',
    external_payment_id:
      row.external_payment_id != null ? String(row.external_payment_id) : null,
    processed_at: processedAt != null ? String(processedAt) : null,
    generated_obligations: Boolean(row.generated_obligations),
    created_at: createdAt != null ? String(createdAt) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
    return_payment_or_no:
      row.return_payment_or_no != null ? Boolean(row.return_payment_or_no) : null,
    payment_date: paymentDate,
  }
}

export function getPaymentTimestamp(payment: Payment): number {
  return new Date(payment.payment_date).getTime()
}

/** Revenue metrics: exclude failed/pending unless explicitly processed. */
export function isPaymentCountedForRevenue(payment: Payment): boolean {
  const status = (payment.status ?? '').toLowerCase()
  if (status === 'failed') return false
  if (payment.processed_at) return true
  if (status === 'completed' || status === 'succeeded' || status === 'paid') return true
  return false
}
