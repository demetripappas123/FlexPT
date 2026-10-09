import { fetchSessions } from './fetchsessions'
import { fetchPersonPackages } from './fetchpersonpackages'
import { DateRangeBounds } from '../utils/daterange'
import {
  getSessionDateForMetrics,
  getTrainedRevenueForSession,
} from '../utils/dashboardMetrics'

/**
 * Sum person_packages.unit_cost for completed client sessions with a person_package_id.
 */
export async function fetchTrainedRevenue(
  trainerId?: string | null,
  dateRange?: DateRangeBounds
): Promise<number> {
  const [sessions, personPackages] = await Promise.all([
    fetchSessions(trainerId),
    fetchPersonPackages(trainerId),
  ])

  const personPackageMap = new Map(personPackages.map((pp) => [pp.id, pp]))

  let clientSessions = sessions.filter(
    (s) => s.type === 'Client Session' && s.status === 'completed' && s.person_package_id
  )

  if (dateRange) {
    clientSessions = clientSessions.filter((s) => {
      const sessionDate = getSessionDateForMetrics(s)
      if (!sessionDate) return false
      return sessionDate >= dateRange.start && sessionDate <= dateRange.end
    })
  }

  let total = 0
  for (const session of clientSessions) {
    const pp = personPackageMap.get(session.person_package_id!)
    total += getTrainedRevenueForSession(pp)
  }

  return total
}
