'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { fetchDashboardMetricsProgressive } from '@/supabase/fetches/fetchdashboardmetrics'
import { fetchNewClientsThisMonth, fetchNewLeadsThisMonth, fetchPaymentAudit, PaymentAudit, fetchLeadSources, fetchProspectsForScatter } from '@/supabase/fetches/fetchdashboardquickmetrics'
import { fetchPeople } from '@/supabase/fetches/fetchpeople'
import { fetchSessions, Session } from '@/supabase/fetches/fetchsessions'
import { suggestMissedSessions } from '@/supabase/utils/sessionMissed'
import Link from 'next/link'
import CloseRateChart from '@/modules/dashboard/closeratechart'
import ShowRateChart from '@/modules/dashboard/showratechart'
import AverageBookingsPerDayChart from '@/modules/dashboard/averagebookingsperdaychart'
import HourlyAverageChart from '@/modules/dashboard/hourlyaveragechart'
import QuickMetricCard from '@/modules/dashboard/quickmetriccard'
import ToggleRevenueCard from '@/modules/dashboard/togglerevenuecard'
import LeadSourcesChart from '@/modules/dashboard/leadsourceschart'
import { Users, UserPlus, DollarSign, Calendar, ListTodo } from 'lucide-react'
import {
  DashboardPeriod,
  dashboardPeriodBounds,
  dashboardPeriodToChartRange,
  formatDashboardPeriod,
} from '@/supabase/utils/daterange'
import { addDays, format, subMinutes } from 'date-fns'
import { fetchOpenTasks, Task } from '@/supabase/fetches/fetchtasks'
import TaskFeed from '@/modules/dashboard/taskfeed'
import BehindOnSessions from '@/modules/dashboard/behindonsessions'
import { ClientSessionsBehind, fetchClientsBehindOnSessions } from '@/supabase/utils/sessionsBehind'

function sessionTimeUntil(startTime: Date | null): { relative: string; clock: string | null } {
  if (!startTime) return { relative: 'Time TBD', clock: null }
  const diffMs = startTime.getTime() - Date.now()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  let relative = `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffMins < 0) relative = 'Started'
  else if (diffMins < 60) relative = `In ${diffMins} min${diffMins !== 1 ? 's' : ''}`
  else if (diffHours < 24) relative = `In ${diffHours} hr${diffHours !== 1 ? 's' : ''}`
  return { relative, clock: format(startTime, 'EEE h:mm a') }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [closeRate, setCloseRate] = useState<number | null>(null)
  const [showRate, setShowRate] = useState<number | null>(null)
  const [ratesLoaded, setRatesLoaded] = useState(false)
  const [hourlyLoaded, setHourlyLoaded] = useState(false)
  const [averageBookings, setAverageBookings] = useState<number | null>(null)
  const [trainedRevenue, setTrainedRevenue] = useState<number | null>(null)
  const [hourlyAverage, setHourlyAverage] = useState<number | null>(null)
  const [mtdRevenue, setMtdRevenue] = useState<number | null>(null)
  const [projectedRevenue, setProjectedRevenue] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newClients, setNewClients] = useState<number | null>(null)
  const [newLeads, setNewLeads] = useState<number | null>(null)
  const [paymentAudit, setPaymentAudit] = useState<PaymentAudit | null>(null)
  const [leadSources, setLeadSources] = useState<Array<{ source: string; count: number }>>([])
  const [prospectsForScatter, setProspectsForScatter] = useState<Array<{ created_at: string; lead_source: string | null }>>([])
  const [loadingQuickMetrics, setLoadingQuickMetrics] = useState(false)
  const [upcomingSessions, setUpcomingSessions] = useState<Array<Session & { personName?: string }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [clientsBehind, setClientsBehind] = useState<ClientSessionsBehind[]>([])
  const [loadingBehind, setLoadingBehind] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const rangeBounds = useMemo(
    () => dashboardPeriodBounds(period, customStart, customEnd),
    [period, customStart, customEnd]
  )
  const chartRange = dashboardPeriodToChartRange(period)
  const rangeLabel = formatDashboardPeriod(rangeBounds, period)


  useEffect(() => {
    const loadMetrics = async () => {
      if (!user) return
      try {
        setError(null)
        setRatesLoaded(false)
        setHourlyLoaded(false)
        const metrics = await fetchDashboardMetricsProgressive(user.id, rangeBounds)

        // Load all metrics in parallel, update state as each completes
        Promise.all([
          metrics.closeRate.then(value => setCloseRate(value)),
          metrics.showRate.then(value => setShowRate(value)),
        ])
          .catch(err => console.error('Error loading rates:', err))
          .finally(() => setRatesLoaded(true))
        
        metrics.averageBookings
          .then(value => setAverageBookings(value))
          .catch(err => console.error('Error loading average bookings:', err))
        
        metrics.hourlyAverage
          .then(value => setHourlyAverage(value))
          .catch(err => console.error('Error loading hourly average:', err))
          .finally(() => setHourlyLoaded(true))
        
        metrics.trainedRevenue
          .then(value => setTrainedRevenue(value))
          .catch(err => console.error('Error loading trained revenue:', err))
        
        metrics.mtdRevenue
          .then(value => setMtdRevenue(value))
          .catch(err => console.error('Error loading MTD revenue:', err))
        
        metrics.projectedRevenue
          .then(value => setProjectedRevenue(value))
          .catch(err => console.error('Error loading projected revenue:', err))
      } catch (err) {
        console.error('Error loading dashboard metrics:', err)
        setError('Failed to load dashboard metrics')
      }
    }

    loadMetrics()
  }, [user, rangeBounds])

  useEffect(() => {
    const loadQuickMetrics = async () => {
      if (!user) return
      setLoadingQuickMetrics(true)
      try {
        const [clients, leads, payments, sources, prospects] = await Promise.all([
          fetchNewClientsThisMonth(user.id, rangeBounds),
          fetchNewLeadsThisMonth(user.id, rangeBounds),
          fetchPaymentAudit(user.id, rangeBounds),
          fetchLeadSources(user.id, rangeBounds),
          fetchProspectsForScatter(user.id, rangeBounds),
        ])
        setNewClients(clients)
        setNewLeads(leads)
        setPaymentAudit(payments)
        setLeadSources(sources)
        setProspectsForScatter(prospects)
      } catch (err) {
        console.error('Error loading quick metrics:', err)
      } finally {
        setLoadingQuickMetrics(false)
      }
    }

    loadQuickMetrics()
  }, [user, rangeBounds])

  useEffect(() => {
    const loadUpcomingSessions = async () => {
      if (!user) return
      setLoadingSessions(true)
      try {
        const sessions = await suggestMissedSessions(await fetchSessions(user.id))
        const now = new Date()
        const today = now.toDateString()
        
        console.log('Loading upcoming sessions, current time:', now.toISOString())
        console.log('Today date string:', today)
        console.log('Total sessions:', sessions.length)
        
        // First, let's see all sessions with start_time from today
        const todaySessions = sessions.filter(s => {
          if (!s.start_time) return false
          const startTime = new Date(s.start_time)
          return startTime.toDateString() === today
        })
        console.log('Sessions from today:', todaySessions.length, todaySessions.map(s => ({
          id: s.id,
          start_time: s.start_time,
          status: s.status,
          type: s.type
        })))
        
        // Get upcoming sessions (start_time in the future or today, not cancelled, not completed)
        // Include ALL in_progress sessions regardless of time window
        const upcoming = sessions.filter(session => {
          if (session.missed === 'suggested') {
            if (!session.start_time) return true
            const ageMs = now.getTime() - new Date(session.start_time).getTime()
            return ageMs <= 7 * 24 * 60 * 60 * 1000
          }

          // Exclude cancelled sessions
          if (session.status === 'canceled_with_charge' || session.status === 'canceled_no_charge') {
            console.log('❌ Cancelled:', session.id, session.status)
            return false
          }
          
          // Exclude completed sessions
          if (session.status === 'completed') {
            console.log('❌ Completed:', session.id)
            return false
          }
          
          // Include ALL in_progress sessions (they're active and haven't finished yet)
          // Don't apply time window filter to in_progress sessions
          if (session.status === 'in_progress') {
            console.log(`✅ Including in_progress session ${session.id}:`, {
              start_time: session.start_time,
              started_at: session.started_at,
              status: session.status
            })
            return true
          }
          
          // For pending sessions, apply time window filter
          // Must have start_time
          if (!session.start_time) {
            console.log('❌ No start_time:', session.id, session.type, session.status)
            return false
          }
          
          // Include sessions from 15 minutes in the past to 3 days in the future
          const startTime = new Date(session.start_time)
          
          // Check if date is valid
          if (isNaN(startTime.getTime())) {
            console.log('❌ Invalid start_time:', session.id, session.start_time)
            return false
          }
          
          const fifteenMinutesAgo = subMinutes(now, 15)
          const threeDaysFromNow = addDays(now, 3)
          
          // Session must be >= 15 minutes ago AND <= 3 days from now
          // Use direct time comparison for clarity
          const startTimeMs = startTime.getTime()
          const windowStartMs = fifteenMinutesAgo.getTime()
          const windowEndMs = threeDaysFromNow.getTime()
          
          const willInclude = startTimeMs >= windowStartMs && startTimeMs <= windowEndMs
          
          const minutesFromNow = Math.round((startTimeMs - now.getTime()) / (60 * 1000))
          
          if (willInclude) {
            console.log(`✅ Including session ${session.id}:`, {
              start_time: session.start_time,
              startTimeISO: startTime.toISOString(),
              nowISO: now.toISOString(),
              windowStart: fifteenMinutesAgo.toISOString(),
              windowEnd: threeDaysFromNow.toISOString(),
              status: session.status,
              minutesFromNow,
              startTimeMs,
              windowStartMs,
              windowEndMs
            })
          } else {
            const isBeforeWindow = startTimeMs < windowStartMs
            const isAfterWindow = startTimeMs > windowEndMs
            const reason = isBeforeWindow ? 'too old (before 15 min window)' : isAfterWindow ? 'too far in future (after 3 days)' : 'unknown'
            console.log(`❌ Excluding session ${session.id} - ${reason}`)
            console.log('  Details:', {
              start_time: session.start_time,
              startTimeISO: startTime.toISOString(),
              nowISO: now.toISOString(),
              windowStart: fifteenMinutesAgo.toISOString(),
              windowEnd: threeDaysFromNow.toISOString(),
              status: session.status,
              minutesFromNow,
              startTimeMs,
              windowStartMs,
              windowEndMs,
              isBeforeWindow,
              isAfterWindow
            })
          }
          
          return willInclude
        })
        
        console.log('Upcoming sessions after filter:', upcoming.length)
        console.log('Window boundaries:', {
          now: now.toISOString(),
          fifteenMinutesAgo: subMinutes(now, 15).toISOString(),
          threeDaysFromNow: addDays(now, 3).toISOString()
        })
        
        // Get all people to map person_id to names
        const people = await fetchPeople({ trainerId: user.id })
        const peopleMap = new Map(people.map(p => [p.id, p.name]))
        
        // Sort by start_time ascending (soonest first) and limit to 7
        const sortedSessions = upcoming
          .map(session => ({
            ...session,
            personName: session.person_id ? peopleMap.get(session.person_id) || 'Unknown' : 'Unknown'
          }))
          .sort((a, b) => {
            const missedFirst = Number(b.missed === 'suggested') - Number(a.missed === 'suggested')
            if (missedFirst !== 0) return missedFirst
            const timeA = a.start_time ? new Date(a.start_time).getTime() : 0
            const timeB = b.start_time ? new Date(b.start_time).getTime() : 0
            return timeA - timeB
          })
          .slice(0, 7)
        
        console.log('Setting upcoming sessions:', sortedSessions.length, sortedSessions)
        setUpcomingSessions(sortedSessions)
      } catch (err) {
        console.error('Error loading upcoming sessions:', err)
        setUpcomingSessions([])
      } finally {
        setLoadingSessions(false)
      }
    }

    loadUpcomingSessions()

    const loadTasks = async () => {
      if (!user) return
      setLoadingTasks(true)
      try {
        const data = await fetchOpenTasks(user.id, 20)
        setOpenTasks(data)
      } catch (err) {
        console.error('Error loading tasks:', err)
        setOpenTasks([])
      } finally {
        setLoadingTasks(false)
      }
    }
    loadTasks()

    const loadBehind = async () => {
      if (!user) return
      setLoadingBehind(true)
      try {
        setClientsBehind(await fetchClientsBehindOnSessions(user.id))
      } catch (err) {
        console.error('Error loading clients behind on sessions:', err)
        setClientsBehind([])
      } finally {
        setLoadingBehind(false)
      }
    }
    loadBehind()
  }, [user])

  if (error) {
    return (
      <div className="w-full">
        <h1 className="text-[26px] font-normal tracking-tight mb-6">Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{error}</div>
        </div>
      </div>
    )
  }

  const periodOptions: { id: DashboardPeriod; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              {periodOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                  className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    period === option.id
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                  aria-label="Start date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                  aria-label="End date"
                />
              </div>
            )}
          </div>
          <div className="flex items-start gap-3">
            {ratesLoaded ? (
              <>
                <CloseRateChart closeRate={closeRate} compact />
                <ShowRateChart showRate={showRate} compact />
              </>
            ) : (
              <>
                <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
                <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
        <QuickMetricCard
          title="New Clients"
          value={newClients}
          icon={<Users className="h-4 w-4" />}
          loading={loadingQuickMetrics}
        />
        <QuickMetricCard
          title="New Leads"
          value={newLeads}
          icon={<UserPlus className="h-4 w-4" />}
          loading={loadingQuickMetrics}
        />
        <QuickMetricCard
          title="Audit"
          value={paymentAudit ? `${paymentAudit.successful} / ${paymentAudit.due}` : null}
          detail="paid / due"
          icon={<DollarSign className="h-4 w-4" />}
          loading={loadingQuickMetrics}
        />
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Bookings</h3>
          {averageBookings !== null ? (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <p className="text-2xl font-normal tracking-tight text-foreground">{averageBookings.toLocaleString()}</p>
            </div>
          ) : (
            <div className="h-8 bg-muted rounded animate-pulse" />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Avg Bookings/Day</h3>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          {user?.id ? (
            <AverageBookingsPerDayChart compact trainerId={user.id} />
          ) : (
            <div className="h-8 bg-muted rounded animate-pulse" />
          )}
        </div>
      </div>

      <BehindOnSessions clients={clientsBehind} loading={loadingBehind} />

      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <div className="min-w-0 lg:flex-[1.35]">
          <ToggleRevenueCard
            mtdRevenue={mtdRevenue}
            projectedRevenue={projectedRevenue}
            trainedRevenue={trainedRevenue}
            dateRange={chartRange}
            trainerId={user?.id}
          />
        </div>

        <div className="flex min-w-0 flex-1 gap-4">
          <section className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <ListTodo className="h-4 w-4 text-primary shrink-0" />
                <h2 className="text-sm font-semibold truncate">Tasks</h2>
                {!loadingTasks && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground">
                    {openTasks.length}
                  </span>
                )}
              </div>
              <Link
                href="/tasks"
                className="text-xs text-foreground hover:text-muted-foreground transition-colors shrink-0"
              >
                See all
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TaskFeed
                tasks={openTasks}
                loading={loadingTasks}
                compact
                onFulfilled={async () => {
                  if (!user) return
                  try {
                    setOpenTasks(await fetchOpenTasks(user.id, 20))
                  } catch (err) {
                    console.error('Error reloading tasks:', err)
                  }
                }}
              />
            </div>
          </section>

          <section className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <h2 className="text-sm font-semibold truncate">Sessions</h2>
                {!loadingSessions && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground">
                    {upcomingSessions.length}
                  </span>
                )}
              </div>
              <Link
                href="/calendar"
                className="text-xs text-foreground hover:text-muted-foreground transition-colors shrink-0"
              >
                Calendar
              </Link>
            </div>
            {loadingSessions ? (
              <div className="text-muted-foreground text-sm py-8 text-center">Loading...</div>
            ) : upcomingSessions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-2">
                No sessions in the next few days
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {upcomingSessions.map((session) => {
                  const startTime = session.start_time ? new Date(session.start_time) : null
                  const when = sessionTimeUntil(startTime)
                  return (
                    <Link
                      key={session.id}
                      href={`/events/${session.id}`}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/60 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-medium text-foreground">
                          {session.personName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                          {session.personName || 'Unknown'}
                        </p>
                        <p className={`flex items-center gap-1 text-[11px] truncate ${session.missed === 'suggested' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3 w-3 shrink-0 text-primary" />
                          <span className="truncate">{session.missed === 'suggested' ? 'Looks missed' : (when.clock ?? when.relative)}</span>
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
        <LeadSourcesChart
          sources={leadSources}
          prospects={prospectsForScatter}
          loading={loadingQuickMetrics}
          dateRange={chartRange}
        />
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center min-h-[160px]">
          {hourlyLoaded ? (
            <HourlyAverageChart hourlyAverage={hourlyAverage} />
          ) : (
            <div className="h-16 w-24 bg-muted rounded animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}
