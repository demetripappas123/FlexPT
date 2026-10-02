'use client'

import React, { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, isYesterday, isToday, differenceInCalendarDays } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AddEventDialog from '@/modules/calendar/addevent'
import {
  fetchClientRoster,
  ClientRosterRow,
  ClientRosterStatus,
  ClientRosterFlag,
} from '@/supabase/fetches/fetchclientroster'

export interface DisplayClientsRef {
  refresh: () => Promise<void>
}

const STATUS_LABEL: Record<ClientRosterStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  trial: 'Trial',
  ending: 'Ending',
  inactive: 'Inactive',
}

const STATUS_CLASS: Record<ClientRosterStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-muted text-muted-foreground',
  trial: 'bg-primary/15 text-primary',
  ending: 'bg-amber-500/15 text-amber-400',
  inactive: 'bg-muted text-muted-foreground',
}

const FLAG_LABEL: Record<ClientRosterFlag, string> = {
  payment_failed: 'Payment failed',
  past_due: 'Past due',
  expiring: 'Expiring',
  unscheduled: 'Unscheduled',
  checkin_overdue: 'Check-in overdue',
}

function formatMoney(value: number | null): string {
  if (value == null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatSessionWhen(iso: string | null): string {
  if (!iso) return 'Not scheduled'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Not scheduled'
  if (isToday(date)) return `Today ${format(date, 'h:mm a')}`
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

function formatActivity(iso: string | null): string {
  if (!iso) return 'No activity'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No activity'
  if (isToday(date)) return 'Active today'
  if (isYesterday(date)) return 'Active yesterday'
  const days = differenceInCalendarDays(new Date(), date)
  return `No activity ${Math.max(days, 1)}d`
}

function formatCheckInColumn(row: ClientRosterRow): { title: string; detail: string; overdue: boolean } {
  if (row.checkInOverdue) {
    return {
      title: 'Overdue',
      detail: row.lastCheckInAt
        ? `Last ${format(new Date(row.lastCheckInAt), 'MMM d')}`
        : 'No form completed',
      overdue: true,
    }
  }
  if (row.lastCheckInAt) {
    const date = new Date(row.lastCheckInAt)
    return {
      title: 'Completed',
      detail: Number.isNaN(date.getTime())
        ? `${row.checkInsCompleted} form${row.checkInsCompleted === 1 ? '' : 's'}`
        : format(date, 'MMM d, yyyy'),
      overdue: false,
    }
  }
  if (row.checkInsCompleted > 0) {
    return {
      title: 'Completed',
      detail: `${row.checkInsCompleted} form${row.checkInsCompleted === 1 ? '' : 's'}`,
      overdue: false,
    }
  }
  return { title: '—', detail: 'No check-in yet', overdue: false }
}

function lastPaymentLabel(row: ClientRosterRow): string {
  if (row.lastPaymentStatus === 'failed') return 'Failed'
  if (row.lastPaymentStatus === 'past_due') return 'Past due'
  if (row.lastPaymentStatus === 'paid') return 'Paid'
  return 'No payment'
}

function mockCompliance(id: string, status: ClientRosterStatus): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0
  const ranges: Record<ClientRosterStatus, [number, number]> = {
    active: [72, 98],
    trial: [62, 92],
    ending: [48, 82],
    paused: [28, 68],
    inactive: [12, 48],
  }
  const [min, max] = ranges[status]
  return min + (hash % (max - min + 1))
}

function complianceColor(percent: number): string {
  if (percent >= 80) return '#22c55e'
  if (percent >= 60) return '#eab308'
  return '#ef4444'
}

function ComplianceRing({ value }: { value: number }) {
  const size = 40
  const stroke = 3.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100)

  return (
    <div className="relative w-10 h-10" title={`Placeholder compliance ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complianceColor(value)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums leading-none">
        {value}
      </span>
    </div>
  )
}

const DisplayClients = forwardRef<DisplayClientsRef>((_props, ref) => {
  const router = useRouter()
  const { user } = useAuth()
  const [rows, setRows] = useState<ClientRosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [schedulePersonId, setSchedulePersonId] = useState<string | null>(null)

  const loadClients = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await fetchClientRoster(user.id)
      setRows(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to load clients.')
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({
    refresh: loadClients,
  }))

  useEffect(() => {
    if (user) loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? rows.filter((row) => {
          return (
            row.name.toLowerCase().includes(q) ||
            (row.number || '').toLowerCase().includes(q) ||
            (row.coachName || '').toLowerCase().includes(q) ||
            STATUS_LABEL[row.status].toLowerCase().includes(q)
          )
        })
      : rows
    return [...list].sort((a, b) => {
      const order: Record<ClientRosterStatus, number> = {
        active: 0,
        trial: 1,
        ending: 2,
        paused: 3,
        inactive: 4,
      }
      const byStatus = order[a.status] - order[b.status]
      if (byStatus !== 0) return byStatus
      return a.name.localeCompare(b.name)
    })
  }, [rows, query])

  if (error) return <div className="text-destructive">{error}</div>

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="max-w-xs bg-card"
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Client</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Status</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Coach</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Sessions</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Activity</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Check-in</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Billing</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Renewal</th>
                <th className="font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Compliance</th>
                <th className="font-medium text-muted-foreground px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    Loading clients…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {query ? 'No matching clients.' : 'No clients yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const checkIn = formatCheckInColumn(row)
                  return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/people/${row.id}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-3 min-w-[180px]">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-primary">
                            {row.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{row.name}</p>
                          {row.flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {row.flags.map((flag) => (
                                <span
                                  key={flag}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                >
                                  {FLAG_LABEL[flag]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-foreground whitespace-nowrap">
                      {row.coachName || '—'}
                    </td>
                    <td className="px-4 py-3 align-top min-w-[160px]">
                      <p className="text-foreground">{formatSessionWhen(row.nextSessionAt)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.sessionsRemaining} remaining
                        {row.sessionsToSchedule > 0 ? ` · ${row.sessionsToSchedule} to schedule` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top min-w-[140px]">
                      <p className="text-foreground">{formatActivity(row.lastActivityAt)}</p>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <p className={checkIn.overdue ? 'text-amber-400' : 'text-foreground'}>
                        {checkIn.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{checkIn.detail}</p>
                    </td>
                    <td className="px-4 py-3 align-top min-w-[170px]">
                      <p className="text-foreground">
                        {row.nextBillAt
                          ? `Next ${format(new Date(row.nextBillAt), 'MMM d')}${row.nextBillAmount != null ? ` · ${formatMoney(row.nextBillAmount)}` : ''}`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lastPaymentLabel(row)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <p className="text-foreground">
                        {row.renewalDate && !Number.isNaN(new Date(row.renewalDate).getTime())
                          ? format(new Date(row.renewalDate), 'MMM d, yyyy')
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.renewalLabel}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ComplianceRing value={mockCompliance(row.id, row.status)} />
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                            title="Actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem onClick={() => router.push(`/people/${row.id}`)}>
                            Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSchedulePersonId(row.id)}>
                            Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/people/${row.id}`)}>
                            Program
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/people/${row.id}`)}>
                            Billing
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddEventDialog
        key={schedulePersonId ?? 'idle'}
        initialPersonId={schedulePersonId}
        initialType="Client Session"
        open={schedulePersonId != null}
        onOpenChange={(next) => {
          if (!next) setSchedulePersonId(null)
        }}
      />
    </div>
  )
})

DisplayClients.displayName = 'DisplayClients'

export default DisplayClients
