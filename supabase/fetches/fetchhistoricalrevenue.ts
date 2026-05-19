import { sumPaymentsInDateRange } from './fetchpayments'
import { DateRange } from '../utils/daterange'
import { fetchSessions } from './fetchsessions'
import { fetchPersonPackages } from './fetchpersonpackages'
import {
  getSessionDateForMetrics,
  getTrainedRevenueForSession,
} from '../utils/dashboardMetrics'

export interface HistoricalRevenuePoint {
  date: string
  revenue: number
  label: string
}

export async function fetchHistoricalRevenue(
  trainerId?: string | null,
  dateRange: DateRange = 'monthly',
  revenueType: 'revenue' | 'trained' | 'projected' = 'revenue'
): Promise<HistoricalRevenuePoint[]> {
  const now = new Date()
  let periods: { start: Date; end: Date; label: string }[] = []

  if (revenueType === 'projected') {
    for (let i = 2; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(month.getFullYear(), month.getMonth(), 1)
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)
      periods.push({
        start,
        end,
        label: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      })
    }
  } else if (dateRange === 'weekly') {
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - i * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      periods.push({
        start: weekStart,
        end: weekEnd,
        label: `Week ${4 - i}`,
      })
    }
  } else if (dateRange === 'today' || dateRange === 'yesterday') {
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      day.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)
      periods.push({
        start: day,
        end: dayEnd,
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })
    }
  } else {
    for (let i = 2; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(month.getFullYear(), month.getMonth(), 1)
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)
      periods.push({
        start,
        end,
        label: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      })
    }
  }

  const revenuePromises = periods.map(async (period) => {
    if (revenueType === 'trained') {
      return fetchTrainedRevenueForPeriod(trainerId, period.start, period.end)
    }
    return sumPaymentsInDateRange(period.start, period.end, trainerId)
  })

  const revenues = await Promise.all(revenuePromises)

  return periods.map((period, index) => ({
    date: period.start.toISOString(),
    revenue: revenues[index],
    label: period.label,
  }))
}

async function fetchTrainedRevenueForPeriod(
  trainerId: string | null | undefined,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const [sessions, personPackages] = await Promise.all([
    fetchSessions(trainerId),
    fetchPersonPackages(trainerId),
  ])

  const personPackageMap = new Map(personPackages.map((pp) => [pp.id, pp]))

  let clientSessions = sessions.filter(
    (s) =>
      s.type === 'Client Session' &&
      s.status === 'completed' &&
      s.person_package_id
  )

  clientSessions = clientSessions.filter((s) => {
    const sessionDate = getSessionDateForMetrics(s)
    if (!sessionDate) return false
    return sessionDate >= startDate && sessionDate <= endDate
  })

  let total = 0
  for (const session of clientSessions) {
    total += getTrainedRevenueForSession(personPackageMap.get(session.person_package_id!))
  }

  return total
}
