import { fetchSessions } from './fetchsessions'
import { isProspectSessionType } from '../utils/dashboardMetrics'

/**
 * Average prospect sessions created per day over the last N days.
 */
export async function fetchAverageBookingsPerDay(
  days: number,
  trainerId?: string | null
): Promise<number> {
  const sessions = await fetchSessions(trainerId)

  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const bookingsInTimeframe = sessions.filter((session) => {
    if (!isProspectSessionType(session.type)) return false
    const createdAt = new Date(session.created_at)
    return createdAt >= startDate && createdAt <= now
  })

  if (days === 0) return 0
  return bookingsInTimeframe.length / days
}
