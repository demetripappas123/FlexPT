'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeVariables {
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  destructive: string
  // Extended variables
  bgPrimary: string
  bgSecondary: string
  textPrimary: string
  textSecondary: string
  borderPrimary: string
  orangePrimary: string
  orangeHover: string
  bluePrimary: string
  greenPrimary: string
  redPrimary: string
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  variables: ThemeVariables
  getVariable: (varName: string) => string | null
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Default fallback values
const defaultVariables: ThemeVariables = {
  background: '#111111',
  foreground: '#ffffff',
  card: '#1f1f1f',
  cardForeground: '#ffffff',
  primary: '#7c3aed',
  primaryForeground: '#ffffff',
  secondary: '#333333',
  secondaryForeground: '#ffffff',
  muted: '#333333',
  mutedForeground: '#cccccc',
  accent: '#333333',
  accentForeground: '#ffffff',
  border: '#2a2a2a',
  input: '#262626',
  ring: '#7c3aed',
  destructive: '#ef4444',
  bgPrimary: '#111111',
  bgSecondary: '#1f1f1f',
  textPrimary: '#ffffff',
  textSecondary: '#d1d5db',
  borderPrimary: '#2a2a2a',
  orangePrimary: '#7c3aed',
  orangeHover: '#5b21b6',
  bluePrimary: '#3b82f6',
  greenPrimary: '#10b981',
  redPrimary: '#ef4444',
}

function getComputedCssVariable(varName: string): string | null {
  if (typeof window === 'undefined') return null
  const root = document.documentElement
  const style = getComputedStyle(root)
  const value = style.getPropertyValue(varName).trim()
  return value || null
}

function computeThemeVariables(): ThemeVariables {
  if (typeof window === 'undefined') return defaultVariables

  const getVar = (name: string, fallback: string) => 
    getComputedCssVariable(`--color-${name}`) || 
    getComputedCssVariable(`--${name}`) || 
    fallback

  return {
    background: getVar('background', defaultVariables.background),
    foreground: getVar('foreground', defaultVariables.foreground),
    card: getVar('card', defaultVariables.card),
    cardForeground: getVar('card-foreground', defaultVariables.cardForeground),
    primary: getVar('primary', defaultVariables.primary),
    primaryForeground: getVar('primary-foreground', defaultVariables.primaryForeground),
    secondary: getVar('secondary', defaultVariables.secondary),
    secondaryForeground: getVar('secondary-foreground', defaultVariables.secondaryForeground),
    muted: getVar('muted', defaultVariables.muted),
    mutedForeground: getVar('muted-foreground', defaultVariables.mutedForeground),
    accent: getVar('accent', defaultVariables.accent),
    accentForeground: getVar('accent-foreground', defaultVariables.accentForeground),
    border: getVar('border', defaultVariables.border),
    input: getVar('input', defaultVariables.input),
    ring: getVar('ring', defaultVariables.ring),
    destructive: getVar('destructive', defaultVariables.destructive),
    bgPrimary: getVar('bg-primary', defaultVariables.bgPrimary),
    bgSecondary: getVar('bg-secondary', defaultVariables.bgSecondary),
    textPrimary: getVar('text-primary', defaultVariables.textPrimary),
    textSecondary: getVar('text-secondary', defaultVariables.textSecondary),
    borderPrimary: getVar('border-primary', defaultVariables.borderPrimary),
    orangePrimary: getVar('orange-primary', defaultVariables.orangePrimary),
    orangeHover: getVar('orange-hover', defaultVariables.orangeHover),
    bluePrimary: getVar('blue-primary', defaultVariables.bluePrimary),
    greenPrimary: getVar('green-primary', defaultVariables.greenPrimary),
    redPrimary: getVar('red-primary', defaultVariables.redPrimary),
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)
  const [variables, setVariables] = useState<ThemeVariables>(defaultVariables)

  useEffect(() => {
    setMounted(true)
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setTheme(savedTheme)
    } else {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    const effectiveTheme: 'light' | 'dark' = theme

    root.classList.add(effectiveTheme)
    localStorage.setItem('theme', theme)
    console.log('[ThemeProvider] Theme applied:', { theme, effectiveTheme, classList: root.classList.toString() })

    // Compute variables after theme is applied
    // Use a small delay to ensure CSS variables are updated
    const timeoutId = setTimeout(() => {
      const newVars = computeThemeVariables()
      setVariables(newVars)
      console.log('[ThemeProvider] Variables updated:', newVars)
    }, 10)

    return () => clearTimeout(timeoutId)
  }, [theme, mounted])


  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark'
      console.log('[ThemeToggle] Toggling theme:', prev, '->', newTheme)
      return newTheme
    })
  }, [])

  const getVariable = useCallback((varName: string): string | null => {
    return getComputedCssVariable(varName)
  }, [])

  // Memoize context value - must be called before any early returns
  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    variables,
    getVariable,
  }), [theme, variables, toggleTheme, getVariable])

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <ThemeContext.Provider value={contextValue}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
