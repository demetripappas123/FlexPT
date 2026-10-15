import { sumPaymentsInDateRange } from './fetchpayments'
import { DateRangeBounds } from '../utils/daterange'

/**
 * Sum payments in range (MTD when no range). Filter by payments.trainer_id when provided.
 */
export async function fetchTotalRevenue(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<number> {
  let startDate: Date
  let endDate: Date

  if (dateRange) {
    startDate = dateRange.start
    const now = new Date()
    const rangeEnd = new Date(dateRange.end)
    const isCurrentMonth =
      rangeEnd.getMonth() === now.getMonth() && rangeEnd.getFullYear() === now.getFullYear()

    endDate = isCurrentMonth ? now : dateRange.end
  } else {
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = now
  }

  return sumPaymentsInDateRange(startDate, endDate, trainerId)
}
