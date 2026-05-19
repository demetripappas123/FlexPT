import { fetchSessions } from './fetchsessions'
import { fetchPayments } from './fetchpayments'
import { calculateProspectSessionCloseRate, calculateProspectSessionShowRate } from './fetchprospectsessions'
import { fetchTotalRevenue } from './fetchtotalrevenue'
import { fetchTrainedRevenue } from './fetchtrainedrevenue'
import { fetchProjectedRevenue } from './fetchprojectedrevenue'
import { fetchPersonPackages } from './fetchpersonpackages'
import { DateRangeBounds } from '../utils/daterange'
import {
  isProspectSessionType,
  getSessionDateForMetrics,
  getSessionDurationHours,
  getTrainedRevenueForSession,
} from '../utils/dashboardMetrics'

export interface DashboardMetrics {
  closeRate: number
  showRate: number
  averageBookings: number
  revenue: number
  trainedRevenue: number
  hourlyAverage: number
  mtdRevenue: number
  projectedRevenue: number
}

async function calculateCloseRate(dateRange?: DateRangeBounds): Promise<number> {
  return calculateProspectSessionCloseRate(dateRange)
}

async function calculateShowRate(dateRange?: DateRangeBounds): Promise<number> {
  return calculateProspectSessionShowRate(dateRange)
}

async function calculateAverageBookings(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<number> {
  const sessions = await fetchSessions(trainerId)

  const bookings = sessions.filter((session) => {
    if (!isProspectSessionType(session.type)) return false
    if (!session.start_time) return false
    if (dateRange) {
      const createdAt = new Date(session.created_at)
      if (createdAt < dateRange.start || createdAt > dateRange.end) return false
    }
    return true
  })

  return bookings.length
}

async function calculateRevenue(trainerId?: string | null): Promise<number> {
  const payments = await fetchPayments(trainerId)
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
}

/**
 * Average hourly rate from completed/charged client sessions using person_packages.unit_cost.
 */
async function calculateHourlyAverage(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<number> {
  const [sessions, personPackages] = await Promise.all([
    fetchSessions(trainerId),
    fetchPersonPackages(trainerId),
  ])

  const personPackageMap = new Map(personPackages.map((pp) => [pp.id, pp]))

  let relevantSessions = sessions.filter(
    (s) =>
      s.type === 'Client Session' &&
      (s.status === 'completed' || s.status === 'canceled_with_charge') &&
      s.person_package_id
  )

  if (dateRange) {
    relevantSessions = relevantSessions.filter((s) => {
      const sessionDate = getSessionDateForMetrics(s)
      if (!sessionDate) return false
      return sessionDate >= dateRange.start && sessionDate <= dateRange.end
    })
  }

  if (relevantSessions.length === 0) return 0

  const hourlyRates: number[] = []

  for (const session of relevantSessions) {
    const personPackage = personPackageMap.get(session.person_package_id!)
    const unitCost = getTrainedRevenueForSession(personPackage)
    if (unitCost <= 0) continue

    const hours = getSessionDurationHours(session)
    if (hours <= 0) continue

    const hourlyRate = unitCost / hours
    if (!isNaN(hourlyRate) && hourlyRate > 0) {
      hourlyRates.push(hourlyRate)
    }
  }

  if (hourlyRates.length === 0) return 0
  return hourlyRates.reduce((acc, rate) => acc + rate, 0) / hourlyRates.length
}

export async function fetchDashboardMetrics(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<DashboardMetrics> {
  const [closeRate, showRate, averageBookings, revenue, trainedRevenue, hourlyAverage, mtdRevenue, projectedRevenue] =
    await Promise.all([
      calculateCloseRate(dateRange),
      calculateShowRate(dateRange),
      calculateAverageBookings(trainerId, dateRange),
      calculateRevenue(trainerId),
      fetchTrainedRevenue(trainerId, dateRange),
      calculateHourlyAverage(trainerId, dateRange),
      fetchTotalRevenue(trainerId, dateRange),
      fetchProjectedRevenue(trainerId),
    ])

  return {
    closeRate: Math.round(closeRate * 100) / 100,
    showRate: Math.round(showRate * 100) / 100,
    averageBookings: Math.round(averageBookings),
    revenue: Math.round(revenue * 100) / 100,
    trainedRevenue: Math.round(trainedRevenue * 100) / 100,
    hourlyAverage: Math.round(hourlyAverage * 100) / 100,
    mtdRevenue: Math.round(mtdRevenue * 100) / 100,
    projectedRevenue: Math.round(projectedRevenue * 100) / 100,
  }
}

export async function fetchDashboardMetricsProgressive(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<{
  closeRate: Promise<number>
  showRate: Promise<number>
  averageBookings: Promise<number>
  revenue: Promise<number>
  trainedRevenue: Promise<number>
  hourlyAverage: Promise<number>
  mtdRevenue: Promise<number>
  projectedRevenue: Promise<number>
}> {
  return {
    closeRate: calculateCloseRate(dateRange).then((r) => Math.round(r * 100) / 100),
    showRate: calculateShowRate(dateRange).then((r) => Math.round(r * 100) / 100),
    averageBookings: calculateAverageBookings(trainerId, dateRange).then((r) => Math.round(r)),
    revenue: calculateRevenue(trainerId).then((r) => Math.round(r * 100) / 100),
    trainedRevenue: fetchTrainedRevenue(trainerId, dateRange).then((r) => Math.round(r * 100) / 100),
    hourlyAverage: calculateHourlyAverage(trainerId, dateRange).then((r) => Math.round(r * 100) / 100),
    mtdRevenue: fetchTotalRevenue(trainerId, dateRange).then((r) => Math.round(r * 100) / 100),
    projectedRevenue: fetchProjectedRevenue(trainerId).then((r) => Math.round(r * 100) / 100),
  }
}
