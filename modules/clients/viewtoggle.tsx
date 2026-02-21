'use client'

import React from 'react'
import { Calendar, List } from 'lucide-react'

type ViewToggleProps = {
  view: 'list' | 'calendar'
  onViewChange: (view: 'list' | 'calendar') => void
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-background border border-border rounded-md p-1">
      <button
        onClick={() => onViewChange('list')}
        className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
          view === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewChange('calendar')}
        className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
          view === 'calendar'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  )
}


