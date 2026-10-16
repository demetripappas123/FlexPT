'use client'

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { ClientSessionsBehind } from '@/supabase/utils/sessionsBehind'

type BehindOnSessionsProps = {
  clients: ClientSessionsBehind[]
  loading?: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

export default function BehindOnSessions({ clients, loading }: BehindOnSessionsProps) {
  return (
    <section className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-semibold">Behind on sessions</h2>
        {!loading && (
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
            {clients.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[58px] rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-4">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Everyone is on pace</p>
            <p className="text-xs text-muted-foreground">No clients are behind on their session cadence.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {clients.map((client) => (
            <Link
              key={client.personId}
              href={`/people/${client.personId}`}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/60 transition-colors group min-w-0"
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="text-[11px] font-medium text-foreground">
                  {initials(client.personName)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate transition-colors">
                  {client.personName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {client.held} of {client.expected} held
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-normal leading-none tabular-nums tracking-tight text-foreground">
                  {client.sessionsBehind}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">behind</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
