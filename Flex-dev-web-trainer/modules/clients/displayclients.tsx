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
  ClientRosterFilter,
  CLIENT_ROSTER_FILTERS,
  matchesClientRosterFilter,
  countClientRosterFilters,
} from '@/supabase/fetches/fetchclientroster'
import { clientAvatarUrl } from '@/supabase/storage/clientavatar'

export interface DisplayClientsRef {
  refresh: () => Promise<void>
}

const STATUS_LABEL: Record<ClientRosterStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  trial: 'Onboarding',
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
  solo_overdue: 'Solo workout missed',
}

const FLAG_CLASS: Record<ClientRosterFlag, string> = {
  payment_failed: 'bg-red-500/20 text-red-500',
  past_due: 'bg-red-500/20 text-red-500',
  expiring: 'bg-amber-500/15 text-amber-400',
  unscheduled: 'bg-muted text-muted-foreground',
  checkin_overdue: 'bg-amber-500/15 text-amber-400',
  solo_overdue: 'bg-red-500/20 text-red-500',
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

function formatCheckInColumn(row: ClientRosterRow): {
  title: string
  detail: string
  overdue: boolean
  completedWeek: boolean
} {
  if (row.checkInCompletedThisWeek) {
    return {
      title: 'Completed',
      detail: row.lastCheckInAt
        ? `This week · ${format(new Date(row.lastCheckInAt), 'MMM d')}`
        : 'This week',
      overdue: false,
      completedWeek: true,
    }
  }
  if (row.checkInOverdue) {
    return {
      title: 'Overdue',
      detail: row.lastCheckInAt
        ? `Last ${format(new Date(row.lastCheckInAt), 'MMM d')}`
        : 'No form completed',
      overdue: true,
      completedWeek: false,
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
      completedWeek: false,
    }
  }
  return { title: '—', detail: 'No check-in yet', overdue: false, completedWeek: false }
}

function lastPaymentLabel(row: ClientRosterRow): string {
  if (row.lastPaymentStatus === 'failed') return 'Failed'
  if (row.lastPaymentStatus === 'past_due') return 'Past due'
  if (row.lastPaymentStatus === 'paid') return 'Paid'
  return 'No payment'
}

function complianceColor(percent: number): string {
  if (percent >= 80) return '#22c55e'
  if (percent >= 60) return '#eab308'
  return '#ef4444'
}

function ComplianceRing({ value, label }: { value: number | null; label: string }) {
  if (value == null) {
    return (
      <div className="relative w-10 h-10" title={label}>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          —
        </span>
      </div>
    )
  }
  const size = 40
  const stroke = 3.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100)

  return (
    <div className="relative w-10 h-10" title={label}>
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
  const [filter, setFilter] = useState<ClientRosterFilter>('all')
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

  const filterCounts = useMemo(() => countClientRosterFilters(rows), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((row) => {
      if (!matchesClientRosterFilter(row, filter)) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        (row.number || '').toLowerCase().includes(q) ||
        (row.coachName || '').toLowerCase().includes(q) ||
        STATUS_LABEL[row.status].toLowerCase().includes(q) ||
        (row.inOnboarding && 'onboarding'.includes(q))
      )
    })
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
  }, [rows, query, filter])

  if (error) return <div className="text-destructive">{error}</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="max-w-xs bg-card"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {CLIENT_ROSTER_FILTERS.map((item) => {
            const selected = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.label}
                <span className={selected ? 'ml-1 opacity-80' : 'ml-1 text-muted-foreground'}>
                  {filterCounts[item.id]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

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
                    {query || filter !== 'all' ? 'No matching clients.' : 'No clients yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const checkIn = formatCheckInColumn(row)
                  const paymentOverdue =
                    row.lastPaymentStatus === 'past_due' ||
                    row.lastPaymentStatus === 'failed' ||
                    row.flags.includes('past_due') ||
                    row.flags.includes('payment_failed')
                  return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/people/${row.id}`)}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                      paymentOverdue ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-3 min-w-[180px]">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                          {clientAvatarUrl(row.avatarPath) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={clientAvatarUrl(row.avatarPath)!} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-medium text-foreground">
                              {row.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{row.name}</p>
                          {row.flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {row.flags.map((flag) => (
                                <span
                                  key={flag}
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${FLAG_CLASS[flag]}`}
                                >
                                  {flag === 'solo_overdue' && row.overdueSoloCount > 1
                                    ? `${row.overdueSoloCount} solo workouts missed`
                                    : FLAG_LABEL[flag]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.inOnboarding ? STATUS_CLASS.trial : STATUS_CLASS[row.status]
                        }`}
                      >
                        {row.inOnboarding ? 'Onboarding' : STATUS_LABEL[row.status]}
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
                      <p
                        className={
                          checkIn.completedWeek
                            ? 'text-emerald-400 font-medium'
                            : checkIn.overdue
                              ? 'text-amber-400'
                              : 'text-foreground'
                        }
                      >
                        {checkIn.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{checkIn.detail}</p>
                    </td>
                    <td className="px-4 py-3 align-top min-w-[170px]">
                      <p className={paymentOverdue ? 'text-red-500 font-semibold' : 'text-foreground'}>
                        {row.nextBillAt
                          ? `${paymentOverdue ? 'Overdue' : 'Next'} ${format(new Date(row.nextBillAt), 'MMM d')}${row.nextBillAmount != null ? ` · ${formatMoney(row.nextBillAmount)}` : ''}`
                          : paymentOverdue
                            ? 'Payment overdue'
                            : '—'}
                      </p>
                      <p className={`text-xs mt-0.5 ${paymentOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
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
                      <ComplianceRing value={row.compliance.percent} label={row.complianceLabel} />
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
