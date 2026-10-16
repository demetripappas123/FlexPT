'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState } from 'react'
import { ChevronDown, ChevronRight, LayoutDashboard, Users, UserPlus, Calendar, BookOpen, Folder, Dumbbell, List, UtensilsCrossed, Box, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

function navClass(active: boolean) {
  return cn(
    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/70'
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [libraryExpanded, setLibraryExpanded] = useState(true)
  const libraryActive = ['/programs', '/workout-library', '/exercises', '/nutrition-library', '/checkin-forms'].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside className="sidebar-scrollbar h-full w-56 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <nav className="flex h-full flex-col p-3">
        <div className="flex-1 space-y-1">
          <Link href="/dash" className={navClass(pathname === '/dash')}>
            <LayoutDashboard className="mr-3 h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/clients" className={navClass(isActive('/clients') || pathname.startsWith('/people/'))}>
            <Users className="mr-3 h-4 w-4" />
            Clients
          </Link>
          <Link href="/prospects" className={navClass(isActive('/prospects'))}>
            <UserPlus className="mr-3 h-4 w-4" />
            Prospects
          </Link>
          <Link href="/calendar" className={navClass(isActive('/calendar') || pathname.startsWith('/events/'))}>
            <Calendar className="mr-3 h-4 w-4" />
            Calendar
          </Link>
          <Link href="/packages" className={navClass(isActive('/packages'))}>
            <Box className="mr-3 h-4 w-4" />
            Packages
          </Link>

          <div>
            <button
              type="button"
              onClick={() => setLibraryExpanded(!libraryExpanded)}
              className={cn(navClass(libraryActive), 'w-full justify-between')}
            >
              <span className="flex items-center">
                <BookOpen className="mr-3 h-4 w-4" />
                Library
              </span>
              {libraryExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {libraryExpanded && (
              <div className="mt-1 space-y-1 pl-3">
                <Link href="/programs" className={navClass(isActive('/programs'))}>
                  <Folder className="mr-3 h-4 w-4" />
                  Programs
                </Link>
                <Link href="/workout-library" className={navClass(isActive('/workout-library'))}>
                  <Dumbbell className="mr-3 h-4 w-4" />
                  Workouts
                </Link>
                <Link href="/exercises" className={navClass(isActive('/exercises'))}>
                  <List className="mr-3 h-4 w-4" />
                  Exercises
                </Link>
                <Link href="/nutrition-library" className={navClass(isActive('/nutrition-library'))}>
                  <UtensilsCrossed className="mr-3 h-4 w-4" />
                  Nutrition
                </Link>
                <Link href="/checkin-forms" className={navClass(isActive('/checkin-forms'))}>
                  <ClipboardList className="mr-3 h-4 w-4" />
                  Check-in forms
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </aside>
  )
}
