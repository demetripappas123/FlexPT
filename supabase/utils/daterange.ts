export type DateRange = 'today' | 'yesterday' | 'weekly' | 'monthly'

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




