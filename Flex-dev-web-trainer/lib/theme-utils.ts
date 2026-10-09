/**
 * Theme utility functions for consistent color usage
 * These map to CSS variables defined in globals.css
 */

export const themeColors = {
  // Backgrounds
  bgPrimary: 'bg-[var(--bg-primary)]',
  bgSecondary: 'bg-[var(--bg-secondary)]',
  bgTertiary: 'bg-[var(--bg-tertiary)]',
  bgHover: 'bg-[var(--bg-hover)]',
  bgActive: 'bg-[var(--bg-active)]',
  bgCard: 'bg-card',
  
  // Text
  textPrimary: 'text-[var(--text-primary)]',
  textSecondary: 'text-[var(--text-secondary)]',
  textTertiary: 'text-[var(--text-tertiary)]',
  textMuted: 'text-[var(--text-muted)]',
  textForeground: 'text-foreground',
  
  // Borders
  borderPrimary: 'border-[var(--border-primary)]',
  borderSecondary: 'border-[var(--border-secondary)]',
  borderTertiary: 'border-[var(--border-tertiary)]',
  borderDefault: 'border-border',
  
  // Accent colors (these stay consistent across themes)
  orange: 'text-[var(--orange-primary)]',
  orangeBg: 'bg-[var(--orange-primary)]',
  orangeHover: 'hover:bg-[var(--orange-hover)]',
  blue: 'text-[var(--blue-primary)]',
  blueBg: 'bg-[var(--blue-primary)]',
  green: 'text-[var(--green-primary)]',
  red: 'text-[var(--red-primary)]',
  brand: 'text-[var(--brand)]',
  brandBg: 'bg-[var(--brand)]',
  brandSubtle: 'bg-[var(--brand-subtle)]',
}

/**
 * Helper to combine theme classes
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Get the computed value of a CSS variable.
 * @param varName The name of the CSS variable (e.g., '--color-primary').
 * @returns The computed value as a string, or null if not found.
 */
export function getComputedCssVariable(varName: string): string | null {
  if (typeof window === 'undefined') return null
  const root = document.documentElement
  const style = getComputedStyle(root)
  const value = style.getPropertyValue(varName).trim()
  return value || null
}

/**
 * Converts a hex color string to an RGB string (e.g., "255, 255, 255").
 * Handles both 3-digit and 6-digit hex codes.
 * Returns null if the hex is invalid.
 */
export function hexToRgb(hex: string): string | null {
  if (!hex || typeof hex !== 'string') {
    return null
  }

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : null
}

