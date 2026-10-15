'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { fetchDashboardMetricsProgressive } from '@/supabase/fetches/fetchdashboardmetrics'
import { fetchNewClientsThisMonth, fetchNewLeadsThisMonth, fetchSuccessfulPaymentsThisMonth, fetchLeadSources, fetchProspectsForScatter } from '@/supabase/fetches/fetchdashboardquickmetrics'
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
import { getDateRangeBounds } from '@/supabase/utils/daterange'
import { addDays, format, subMinutes } from 'date-fns'
import { fetchOpenTasks, Task } from '@/supabase/fetches/fetchtasks'
import TaskFeed from '@/modules/dashboard/taskfeed'

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
  const [averageBookings, setAverageBookings] = useState<number | null>(null)
  const [trainedRevenue, setTrainedRevenue] = useState<number | null>(null)
  const [hourlyAverage, setHourlyAverage] = useState<number | null>(null)
  const [mtdRevenue, setMtdRevenue] = useState<number | null>(null)
  const [projectedRevenue, setProjectedRevenue] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newClients, setNewClients] = useState<number | null>(null)
  const [newLeads, setNewLeads] = useState<number | null>(null)
  const [successfulPayments, setSuccessfulPayments] = useState<number | null>(null)
  const [leadSources, setLeadSources] = useState<Array<{ source: string; count: number }>>([])
  const [prospectsForScatter, setProspectsForScatter] = useState<Array<{ created_at: string; lead_source: string | null }>>([])
  const [loadingQuickMetrics, setLoadingQuickMetrics] = useState(false)
  const [upcomingSessions, setUpcomingSessions] = useState<Array<Session & { personName?: string }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)


  useEffect(() => {
    const loadMetrics = async () => {
      if (!user) return
      try {
        setError(null)
        // Revenue uses monthly, bookings use daily
        const revenueRangeBounds = getDateRangeBounds('monthly')
        const bookingsRangeBounds = getDateRangeBounds('today')
        
        // Fetch metrics with different date ranges
        const bookingsMetrics = await fetchDashboardMetricsProgressive(user.id, bookingsRangeBounds)
        const revenueMetrics = await fetchDashboardMetricsProgressive(user.id, revenueRangeBounds)

        // Load all metrics in parallel, update state as each completes
        bookingsMetrics.closeRate
          .then(value => setCloseRate(value))
          .catch(err => console.error('Error loading close rate:', err))
        
        bookingsMetrics.showRate
          .then(value => setShowRate(value))
          .catch(err => console.error('Error loading show rate:', err))
        
        bookingsMetrics.averageBookings
          .then(value => setAverageBookings(value))
          .catch(err => console.error('Error loading average bookings:', err))
        
        bookingsMetrics.hourlyAverage
          .then(value => setHourlyAverage(value))
          .catch(err => console.error('Error loading hourly average:', err))
        
        // Revenue metrics use monthly
        revenueMetrics.trainedRevenue
          .then(value => setTrainedRevenue(value))
          .catch(err => console.error('Error loading trained revenue:', err))
        
        revenueMetrics.mtdRevenue
          .then(value => setMtdRevenue(value))
          .catch(err => console.error('Error loading MTD revenue:', err))
        
        revenueMetrics.projectedRevenue
          .then(value => setProjectedRevenue(value))
          .catch(err => console.error('Error loading projected revenue:', err))
      } catch (err) {
        console.error('Error loading dashboard metrics:', err)
        setError('Failed to load dashboard metrics')
      }
    }

    loadMetrics()
  }, [user])

  useEffect(() => {
    const loadQuickMetrics = async () => {
      if (!user) return
      setLoadingQuickMetrics(true)
      try {
        // All metrics use monthly as default
        const defaultRangeBounds = getDateRangeBounds('monthly')
        const [clients, leads, payments, sources, prospects] = await Promise.all([
          fetchNewClientsThisMonth(user.id, defaultRangeBounds),
          fetchNewLeadsThisMonth(user.id, defaultRangeBounds),
          fetchSuccessfulPaymentsThisMonth(user.id, defaultRangeBounds),
          fetchLeadSources(user.id),
          fetchProspectsForScatter(user.id),
        ])
        setNewClients(clients)
        setNewLeads(leads)
        setSuccessfulPayments(payments)
        setLeadSources(sources)
        setProspectsForScatter(prospects)
      } catch (err) {
        console.error('Error loading quick metrics:', err)
      } finally {
        setLoadingQuickMetrics(false)
      }
    }

    loadQuickMetrics()
  }, [user])

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
  }, [user])

  if (error) {
    return (
      <div className="w-full">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{error}</div>
        </div>
      </div>
    )
  }

  const todayLabel = format(new Date(), 'EEEE, MMM d')

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{todayLabel}</p>
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
          value={successfulPayments}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loadingQuickMetrics}
        />
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Today&apos;s Bookings</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          {averageBookings !== null ? (
            <p className="text-2xl font-bold text-primary">{averageBookings.toLocaleString()}</p>
          ) : (
            <div className="h-8 bg-muted rounded animate-pulse" />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Avg Bookings/Day</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          {user?.id ? (
            <AverageBookingsPerDayChart compact trainerId={user.id} />
          ) : (
            <div className="h-8 bg-muted rounded animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <div className="min-w-0 lg:flex-[1.35]">
          <ToggleRevenueCard
            mtdRevenue={mtdRevenue}
            projectedRevenue={projectedRevenue}
            trainedRevenue={trainedRevenue}
            dateRange="monthly"
            trainerId={user?.id}
          />
        </div>

        <div className="flex min-w-0 flex-1 gap-4">
          <section className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <ListTodo className="h-4 w-4 text-muted-foreground shrink-0" />
                <h2 className="text-sm font-semibold truncate">Tasks</h2>
                {!loadingTasks && (
                  <span className="text-[11px] text-primary bg-primary/15 rounded-full px-2 py-0.5">
                    {openTasks.length}
                  </span>
                )}
              </div>
              <Link
                href="/tasks"
                className="text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
              >
                See all
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TaskFeed tasks={openTasks} loading={loadingTasks} compact />
            </div>
          </section>

          <section className="flex-1 min-w-0 bg-card border border-border rounded-lg p-3 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <h2 className="text-sm font-semibold truncate">Sessions</h2>
                {!loadingSessions && (
                  <span className="text-[11px] text-primary bg-primary/15 rounded-full px-2 py-0.5">
                    {upcomingSessions.length}
                  </span>
                )}
              </div>
              <Link
                href="/calendar"
                className="text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
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
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-semibold text-primary">
                          {session.personName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {session.personName || 'Unknown'}
                        </p>
                        <p className={`text-[11px] truncate ${session.missed === 'suggested' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {session.missed === 'suggested' ? 'Looks missed' : (when.clock ?? when.relative)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeadSourcesChart
          sources={leadSources}
          prospects={prospectsForScatter}
          loading={loadingQuickMetrics}
          dateRange="monthly"
        />
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center min-h-[160px]">
            {closeRate !== null ? (
              <CloseRateChart closeRate={closeRate} />
            ) : (
              <div className="h-24 w-24 bg-muted rounded-full animate-pulse" />
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center min-h-[160px]">
            {showRate !== null ? (
              <ShowRateChart showRate={showRate} />
            ) : (
              <div className="h-24 w-24 bg-muted rounded-full animate-pulse" />
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center min-h-[160px]">
            {hourlyAverage !== null ? (
              <HourlyAverageChart hourlyAverage={hourlyAverage} />
            ) : (
              <div className="h-16 w-24 bg-muted rounded animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
