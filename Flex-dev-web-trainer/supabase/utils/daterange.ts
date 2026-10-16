export type DateRange = 'today' | 'yesterday' | 'weekly' | 'monthly'
export type DashboardPeriod = 'day' | 'week' | 'month' | 'custom'

export interface DateRangeBounds {
  start: Date
  end: Date
}

/**
 * Get date range bounds based on the selected range type
 */
export function getDateRangeBounds(range: DateRange): DateRangeBounds {
  const now = new Date()
  let start: Date
  let end: Date = new Date(now)

  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      break
    
    case 'yesterday':
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
      break
    
    case 'weekly':
      // Last 7 days
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    
    case 'monthly':
      // Current month
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      break
    
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  }

  return { start, end }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Calendar day, week (Monday–Sunday), month, or an inclusive custom range. */
export function dashboardPeriodBounds(
  period: DashboardPeriod,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const now = new Date()
  if (period === 'day') return getDateRangeBounds('today')
  if (period === 'week') {
    const mondayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end: endOfDay(end) }
  }
  if (period === 'month') return getDateRangeBounds('monthly')

  const start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : getDateRangeBounds('monthly').start
  const end = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : getDateRangeBounds('monthly').end
  if (start.getTime() <= end.getTime()) return { start, end }
  return { start: startOfDay(end), end: endOfDay(start) }
}

export function dashboardPeriodToChartRange(period: DashboardPeriod): DateRange {
  if (period === 'day') return 'today'
  if (period === 'week') return 'weekly'
  return 'monthly'
}

export function formatDashboardPeriod(bounds: DateRangeBounds, period: DashboardPeriod): string {
  const sameDay = bounds.start.toDateString() === bounds.end.toDateString()
  const start = bounds.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = bounds.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (period === 'day' || sameDay) {
    return bounds.start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }
  return `${start} – ${end}`
}




