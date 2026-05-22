import { supabase } from '../supabaseClient'
import { fetchClients } from './fetchpeople'
import { fetchPayments, isPaymentCountedForRevenue, getPaymentTimestamp } from './fetchpayments'
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

/**
 * Fetch lead sources data (if lead_source field exists in people table)
 * Returns empty array if lead_source field doesn't exist
 */
export async function fetchLeadSources(trainerId?: string | null): Promise<Array<{ source: string; count: number }>> {
  try {
    let query = supabase
      .from('people')
      .select('lead_source')
      .is('converted_at', null) // Only prospects
    
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
export async function fetchProspectsForScatter(trainerId?: string | null): Promise<Array<{ created_at: string; lead_source: string | null }>> {
  try {
    let query = supabase
      .from('people')
      .select('created_at, lead_source')
      .is('converted_at', null) // Only prospects
      .order('created_at', { ascending: true })
    
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

