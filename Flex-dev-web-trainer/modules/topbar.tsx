'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageSquare, Settings, Shield, LogOut, Moon, Sun } from 'lucide-react'
import AssistantPanel from '@/modules/assistantpanel'
import { useAuth } from '@/context/authcontext'
import { useTheme } from '@/context/themecontext'
import { signOut } from '@/supabase/auth/auth-helpers'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function navButtonClass(active: boolean) {
  return cn(
    'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
    active
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  )
}

export default function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const email = user?.email || ''
  const initial = (email.trim()[0] || 'U').toUpperCase()
  const programMatch = pathname.match(/^\/programs\/([^/]+)$/)
  const programId = programMatch?.[1] ?? null
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'assistant' | 'chats'>(programId ? 'assistant' : 'chats')
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/')

  useEffect(() => {
    setPanelTab(programId ? 'assistant' : 'chats')
  }, [programId])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      console.error('Error signing out:', error)
      alert('Error signing out. Please try again.')
      return
    }
    router.push('/login')
  }

  return (
    <header className="relative z-40 h-16 shrink-0 border-b border-border bg-background text-foreground">
      <div className="relative z-40 flex h-full items-center justify-between gap-4 px-4">
        <Link href="/dash" className="shrink-0 text-lg font-medium tracking-tight text-primary">
          FlexPT
        </Link>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className={navButtonClass(panelOpen)}
            aria-expanded={panelOpen}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chats</span>
          </button>
          <Link
            href="/settings"
            className={navButtonClass(settingsActive)}
            aria-current={settingsActive ? 'page' : undefined}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <button
            type="button"
            disabled
            title="Admin is coming soon"
            className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground/60"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            type="button"
            onClick={() => toggleTheme()}
            className={navButtonClass(false)}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 inline-flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                aria-label="User menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                  {initial}
                </span>
                <span className="hidden max-w-[180px] truncate md:inline">{email || 'Account'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="truncate text-sm font-medium text-foreground">{email || 'Signed in'}</div>
                <div className="text-xs text-muted-foreground">Trainer</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onSelect={() => router.push('/settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onSelect={() => void handleSignOut()}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 top-0 z-30 overflow-hidden bg-card transition-[max-height] duration-200 ease-out ${
          panelOpen ? 'max-h-[calc(100vh-4rem)] border-b border-border' : 'max-h-0'
        }`}
      >
        <div className="flex h-[min(70vh,640px)] flex-col pt-16">
          <AssistantPanel
            programId={programId}
            tab={panelTab}
            onTabChange={setPanelTab}
            onNavigate={() => setPanelOpen(false)}
          />
        </div>
      </div>
      {panelOpen && (
        <button
          type="button"
          className="fixed inset-0 top-16 z-20 bg-foreground/20"
          aria-label="Close chats"
          onClick={() => setPanelOpen(false)}
        />
      )}
    </header>
  )
}
