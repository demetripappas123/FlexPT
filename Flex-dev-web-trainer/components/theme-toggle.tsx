'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/themecontext'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[ThemeToggle] Button clicked, current theme:', theme)
    toggleTheme()
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      className="cursor-pointer"
      aria-label={`Toggle theme. Current: ${theme}`}
      title={`Current: ${theme}. Click to toggle theme.`}
      type="button"
    >
      {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  )
}

