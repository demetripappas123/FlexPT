import { supabase } from '../supabaseClient'
import { fetchClients } from './fetchpeople'
import { fetchContracts, Contract } from './fetchcontracts'
import { fetchPayments, isPaymentCountedForRevenue, getPaymentTimestamp, Payment } from './fetchpayments'
import { DateRangeBounds } from '../utils/daterange'

/**
 * Fetch count of new clients within date range
 * Defaults to current month if no range provided
 */
export async function fetchNewClientsThisMonth(trainerId?: string | null, dateRange?: DateRangeBounds): Promise<number> {
  const clients = await fetchClients(trainerId)
  
  let startDate: Date
  let endDate: Date
  
  if (dateRange) {
    startDate = dateRange.start
    endDate = dateRange.end
  } else {
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = now
  }
  
  const newClients = clients.filter(client => {
    if (!client.converted_at) return false
    const convertedDate = new Date(client.converted_at)
    return convertedDate >= startDate && convertedDate <= endDate
  })
  
  return newClients.length
}

/**
 * Fetch count of new leads (prospects) within date range
 * New leads = people where converted_at is null and created_at is within date range
 * Defaults to current month if no range provided
 */
export async function fetchNewLeadsThisMonth(trainerId?: string | null, dateRange?: DateRangeBounds): Promise<number> {
  let startDate: Date
  let endDate: Date
  
  if (dateRange) {
    startDate = dateRange.start
    endDate = dateRange.end
  } else {
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = now
  }
  
  let query = supabase
    .from('people')
    .select('id', { count: 'exact' })
    .is('converted_at', null) // Only prospects (converted_at is null)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }
  
  const { count, error } = await query
  
  if (error) {
    console.error('Error fetching new leads:', error)
    return 0
  }
  
  return count || 0
}

/**
 * Fetch count of successful payments within date range
 * Defaults to current month if no range provided
 */
export async function fetchSuccessfulPaymentsThisMonth(trainerId?: string | null, dateRange?: DateRangeBounds): Promise<number> {
  const payments = await fetchPayments(trainerId)
  
  let startDate: Date
  let endDate: Date
  
  if (dateRange) {
    startDate = dateRange.start
    endDate = dateRange.end
  } else {
    const now = new Date()
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = now
  }
  
  const successfulPayments = payments.filter((payment) => {
    if (!isPaymentCountedForRevenue(payment)) return false
    const t = getPaymentTimestamp(payment)
    return t >= startDate.getTime() && t <= endDate.getTime()
  })
  
  return successfulPayments.length
}

export type PaymentAudit = {
  successful: number
  due: number
}

function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + weeks * 7)
  return next
}

function dueDatesForContract(contract: Contract, rangeStart: Date, asOf: Date): Date[] {
  const start = parseLocalDate(contract.start_date)
  if (!start || start.getTime() > asOf.getTime()) return []

  if (contract.pif) {
    return start.getTime() >= rangeStart.getTime() ? [start] : []
  }

  const cycleWeeks = Math.max(1, Number(contract.bill_cycle_length_weeks) || 1)
  const dates: Date[] = []
  let cursor = new Date(start)
  for (let i = 0; i < 520 && cursor.getTime() <= asOf.getTime(); i++) {
    if (cursor.getTime() >= rangeStart.getTime()) dates.push(new Date(cursor))
    cursor = addWeeks(cursor, cycleWeeks)
  }
  return dates
}

function cycleWasPaid(payments: Payment[], due: Date, nextDue: Date): boolean {
  return payments.some((payment) => {
    if (!isPaymentCountedForRevenue(payment)) return false
    const paidAt = getPaymentTimestamp(payment)
    return paidAt >= due.getTime() && paidAt < nextDue.getTime()
  })
}

/**
 * Successful collections out of billings that have come due in the range.
 * Dates after the current time are not due yet.
 */
export async function fetchPaymentAudit(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<PaymentAudit> {
  const now = new Date()
  const rangeStart = dateRange?.start ?? new Date(now.getFullYear(), now.getMonth(), 1)
  const rangeEnd = dateRange?.end ?? now
  const asOf = rangeEnd.getTime() < now.getTime() ? rangeEnd : now

  const [contracts, payments] = await Promise.all([
    fetchContracts(trainerId),
    fetchPayments(trainerId),
  ])

  const paymentsByContract = new Map<string, Payment[]>()
  for (const payment of payments) {
    const list = paymentsByContract.get(payment.contract_id) ?? []
    list.push(payment)
    paymentsByContract.set(payment.contract_id, list)
  }

  let due = 0
  let successful = 0

  for (const contract of contracts) {
    if (contract.status === 'cancelled') continue
    const dates = dueDatesForContract(contract, rangeStart, asOf)
    const contractPayments = paymentsByContract.get(contract.id) ?? []
    const cycleWeeks = Math.max(1, Number(contract.bill_cycle_length_weeks) || 1)

    dates.forEach((date, index) => {
      due += 1
      const nextDue = contract.pif
        ? new Date(date.getFullYear() + 5, date.getMonth(), date.getDate())
        : dates[index + 1] ?? addWeeks(date, cycleWeeks)
      if (cycleWasPaid(contractPayments, date, nextDue)) successful += 1
    })
  }

  return { successful, due }
}

/**
 * Fetch lead sources data (if lead_source field exists in people table)
 * Returns empty array if lead_source field doesn't exist
 */
export async function fetchLeadSources(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<Array<{ source: string; count: number }>> {
  try {
    let query = supabase
      .from('people')
      .select('lead_source')
      .is('converted_at', null) // Only prospects

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
    }
    
    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    }
    
    const { data, error } = await query
    
    if (error) {
      // If lead_source column doesn't exist, return empty array
      if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
        return []
      }
      console.error('Error fetching lead sources:', error)
      return []
    }
    
    if (!data || data.length === 0) return []
    
    // Count by lead_source
    const sourceCounts = new Map<string, number>()
    data.forEach((person: any) => {
      const source = person.lead_source || 'Unknown'
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    })
    
    // Convert to array and sort by count
    return Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  } catch (err) {
    console.error('Error fetching lead sources:', err)
    return []
  }
}

/**
 * Fetch prospects with created_at and lead_source for scatter chart
 */
export async function fetchProspectsForScatter(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<Array<{ created_at: string; lead_source: string | null }>> {
  try {
    let query = supabase
      .from('people')
      .select('created_at, lead_source')
      .is('converted_at', null) // Only prospects
      .order('created_at', { ascending: true })

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
    }
    
    if (trainerId) {
      query = query.eq('trainer_id', trainerId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching prospects for scatter:', error)
      return []
    }
    
    return (data || []).map((person: any) => ({
      created_at: person.created_at,
      lead_source: person.lead_source || 'Unknown',
    }))
  } catch (err) {
    console.error('Error fetching prospects for scatter:', err)
    return []
  }
}

