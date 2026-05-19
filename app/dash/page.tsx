'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import { useAuth } from '@/context/authcontext'
import { fetchDashboardMetricsProgressive } from '@/supabase/fetches/fetchdashboardmetrics'
import { fetchNewClientsThisMonth, fetchNewLeadsThisMonth, fetchSuccessfulPaymentsThisMonth, fetchLeadSources, fetchProspectsForScatter } from '@/supabase/fetches/fetchdashboardquickmetrics'
import { fetchProspects, Prospect } from '@/supabase/fetches/fetchpeople'
import { fetchClients, Client } from '@/supabase/fetches/fetchpeople'
import { fetchSessions, Session } from '@/supabase/fetches/fetchsessions'
import { fetchPeople } from '@/supabase/fetches/fetchpeople'
import Link from 'next/link'
import CloseRateChart from '@/modules/dashboard/closeratechart'
import ShowRateChart from '@/modules/dashboard/showratechart'
import AverageBookingsChart from '@/modules/dashboard/averagebookingschart'
import AverageBookingsPerDayChart from '@/modules/dashboard/averagebookingsperdaychart'
import HourlyAverageChart from '@/modules/dashboard/hourlyaveragechart'
import ChartSkeleton from '@/modules/dashboard/chartskeleton'
import QuickMetricCard from '@/modules/dashboard/quickmetriccard'
import ToggleRevenueCard from '@/modules/dashboard/togglerevenuecard'
import LeadSourcesChart from '@/modules/dashboard/leadsourceschart'
import { Users, UserPlus, DollarSign, Calendar } from 'lucide-react'
import { DateRange, getDateRangeBounds } from '@/supabase/utils/daterange'
import { subMinutes, addDays } from 'date-fns'

export default function DashboardPage() {
  const router = useRouter()
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
  const [newLeadsList, setNewLeadsList] = useState<Prospect[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [upcomingSessions, setUpcomingSessions] = useState<Array<Session & { personName?: string }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)


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
    const loadNewLeads = async () => {
      if (!user) return
      setLoadingLeads(true)
      try {
        const prospects = await fetchProspects(user.id)
        // Get new leads from this month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const newLeads = prospects.filter(prospect => {
          const createdDate = new Date(prospect.created_at)
          return createdDate >= startOfMonth && createdDate <= now
        })
        // Sort by most recent first and limit to 5
        setNewLeadsList(newLeads.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 5))
      } catch (err) {
        console.error('Error loading new leads:', err)
      } finally {
        setLoadingLeads(false)
      }
    }

    const loadUpcomingSessions = async () => {
      if (!user) return
      setLoadingSessions(true)
      try {
        const sessions = await fetchSessions(user.id)
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

    loadNewLeads()
    loadUpcomingSessions()
  }, [user])

  if (error) {
    return (
      <div className="w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {/* Quick Metrics Row - Top */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Today's Bookings</h3>
            <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          {averageBookings !== null ? (
            <p className="text-2xl font-bold text-[var(--text-primary)]">{averageBookings.toLocaleString()}</p>
          ) : (
            <div className="h-8 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
          )}
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Avg Bookings/Day</h3>
            <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <AverageBookingsPerDayChart compact trainerId={user?.id} />
        </div>
      </div>

      {/* Revenue and Lead Sources Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Toggleable Revenue Card - Always uses monthly */}
        <ToggleRevenueCard
          mtdRevenue={mtdRevenue}
          projectedRevenue={projectedRevenue}
          trainedRevenue={trainedRevenue}
          dateRange="monthly"
          trainerId={user?.id}
        />

        {/* Lead Sources Chart */}
        <LeadSourcesChart sources={leadSources} prospects={prospectsForScatter} loading={loadingQuickMetrics} dateRange="monthly" />
      </div>

      {/* Bottom Row: All Other Metrics - Close Rate, Show Rate, Hourly Average, Tasks, and Upcoming Sessions */}
      <div className="flex items-start justify-start gap-4">
        {/* Compressed Dials Section - Takes up more space */}
        <div className="flex items-center gap-6" style={{ width: 'calc(50% - 0.5rem)' }}>
          {closeRate !== null ? (
            <CloseRateChart closeRate={closeRate} />
          ) : (
            <div className="w-[100px] h-[130px] flex items-center justify-center">
              <div className="h-24 w-24 bg-[var(--bg-tertiary)] rounded-full animate-pulse"></div>
            </div>
          )}
          {showRate !== null ? (
            <ShowRateChart showRate={showRate} />
          ) : (
            <div className="w-[100px] h-[130px] flex items-center justify-center">
              <div className="h-24 w-24 bg-[var(--bg-tertiary)] rounded-full animate-pulse"></div>
            </div>
          )}
          {hourlyAverage !== null ? (
            <HourlyAverageChart hourlyAverage={hourlyAverage} />
          ) : (
            <div className="w-[100px] h-[130px] flex items-center justify-center">
              <div className="h-16 w-16 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
            </div>
          )}
        </div>
        
        {/* Tasks Section - Compact */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tasks</h2>
            <Link
              href="/tasks"
              className="text-xs text-orange-500 hover:text-orange-600 transition-colors cursor-pointer flex items-center gap-1"
            >
              See All →
            </Link>
          </div>
          <div className="text-[var(--text-secondary)] text-xs">No tasks available</div>
        </div>

        {/* Upcoming Sessions Section - Compact */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 flex-1">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upcoming Sessions</h2>
          </div>
          {loadingSessions ? (
            <div className="text-[var(--text-secondary)] text-xs">Loading...</div>
          ) : upcomingSessions.length === 0 ? (
            <div className="text-[var(--text-secondary)] text-xs">No upcoming sessions</div>
          ) : (
            <>
              <div className="space-y-2">
                {upcomingSessions.map((session) => {
                  const startTime = session.start_time ? new Date(session.start_time) : null
                  const now = new Date()
                  let timeUntil = ''
                  
                  if (startTime) {
                    const diffMs = startTime.getTime() - now.getTime()
                    const diffMins = Math.floor(diffMs / 60000)
                    const diffHours = Math.floor(diffMs / 3600000)
                    const diffDays = Math.floor(diffMs / 86400000)
                    
                    if (diffMins < 60) {
                      timeUntil = `In ${diffMins} min${diffMins !== 1 ? 's' : ''}`
                    } else if (diffHours < 24) {
                      timeUntil = `In ${diffHours} hr${diffHours !== 1 ? 's' : ''}`
                    } else {
                      timeUntil = `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`
                    }
                  } else {
                    timeUntil = 'TBD'
                  }
                  
                  return (
                    <Link
                      key={session.id}
                      href={`/events/${session.id}`}
                      className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-400">
                          {session.personName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-blue-400 transition-colors">
                          {session.personName || 'Unknown'} - {session.type}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{timeUntil}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-primary)]">
                <Link
                  href="/calendar"
                  className="text-xs text-orange-500 hover:text-orange-600 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  See all sessions →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
