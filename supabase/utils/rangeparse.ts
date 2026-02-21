/**
 * Utility functions for parsing and formatting PostgreSQL numrange values
 * 
 * PostgreSQL numrange formats:
 * - "[2,3]" - includes both bounds
 * - "[2,3)" - includes lower, excludes upper
 * - "(2,3]" - excludes lower, includes upper
 * - "(2,3)" - excludes both bounds
 * - Single value can be represented as "[3,3]" or just stored as a range
 */

/**
 * Parses user input (e.g., "2-3", "3", "2-") into PostgreSQL numrange format
 * @param input - User input string like "2-3" or "3"
 * @returns PostgreSQL numrange string format or null if invalid
 */
export function parseRangeInput(input: string | null | undefined): string | null {
  if (!input || input.trim() === '') return null

  const trimmed = input.trim()

  // Handle single number
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10)
    if (isNaN(num)) return null
    // Single value as range [num,num]
    return `[${num},${num}]`
  }

  // Handle range format "2-3", "2 - 3", etc.
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (rangeMatch) {
    const lower = parseInt(rangeMatch[1], 10)
    const upper = parseInt(rangeMatch[2], 10)
    if (isNaN(lower) || isNaN(upper) || lower > upper) return null
    // Inclusive range [lower,upper]
    return `[${lower},${upper}]`
  }

  // Handle open-ended ranges like "2-" (not standard, but might be useful)
  // For now, we'll treat it as invalid - user should provide both bounds

  return null
}

/**
 * Formats a PostgreSQL numrange string into user-friendly display format
 * @param rangeStr - PostgreSQL numrange string like "[2,3]" or "[2,3)"
 * @returns Display string like "2-3" or "3" (for single values), or null
 */
export function formatRangeDisplay(rangeStr: string | null | undefined): string | null {
  if (!rangeStr || rangeStr.trim() === '') return null

  // Remove whitespace
  const trimmed = rangeStr.trim()

  // Match PostgreSQL range format: [bound1,bound2) or similar
  // Patterns: [ or ( for lower bound, number, comma, number, ] or ) for upper bound
  const rangeMatch = trimmed.match(/^([\[\(])\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*([\]\)])$/)
  if (!rangeMatch) return null

  const lowerBound = rangeMatch[1] === '['
  const upperBound = rangeMatch[4] === ']'
  const lower = parseFloat(rangeMatch[2])
  const upper = parseFloat(rangeMatch[3])

  if (isNaN(lower) || isNaN(upper)) return null

  // If single value (lower === upper and both bounds inclusive)
  if (lower === upper && lowerBound && upperBound) {
    return `${Math.round(lower)}`
  }

  // Format as range - we'll assume inclusive for display
  // User can edit if they need different bounds
  return `${Math.round(lower)}-${Math.round(upper)}`
}

/**
 * Converts a number to numrange format (for backward compatibility)
 * @param num - Single number value
 * @returns PostgreSQL numrange string like "[3,3]"
 */
export function numberToRange(num: number | null | undefined): string | null {
  if (num === null || num === undefined) return null
  const rounded = Math.round(num)
  return `[${rounded},${rounded}]`
}

/**
 * Extracts a single number from a range if it's a single value range
 * @param rangeStr - PostgreSQL numrange string
 * @returns The number if it's a single value, null otherwise
 */
export function rangeToNumber(rangeStr: string | null | undefined): number | null {
  if (!rangeStr) return null
  const formatted = formatRangeDisplay(rangeStr)
  if (!formatted) return null
  
  // Check if it's a single number (no dash)
  if (!formatted.includes('-')) {
    const num = parseInt(formatted, 10)
    return isNaN(num) ? null : num
  }
  
  return null
}













