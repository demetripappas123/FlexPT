import { View } from 'react-native'
import { format } from 'date-fns'
import { Card, Empty, ErrorText, Loading, Metric, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchDashboardMetricsProgressive } from '@/src/api/fetches/fetchdashboardmetrics'
import {
  fetchNewClientsThisMonth,
  fetchNewLeadsThisMonth,
  fetchSuccessfulPaymentsThisMonth,
} from '@/src/api/fetches/fetchdashboardquickmetrics'
import { fetchOpenTasks } from '@/src/api/fetches/fetchtasks'
import { fetchSessions } from '@/src/api/fetches/fetchsessions'
import { fetchPeople } from '@/src/api/fetches/fetchpeople'
import { getDateRangeBounds } from '@/src/api/utils/daterange'

export default function DashScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return null
    const revenueRange = getDateRangeBounds('monthly')
    const bookingsRange = getDateRangeBounds('today')
    const bookings = await fetchDashboardMetricsProgressive(user.id, bookingsRange)
    const revenue = await fetchDashboardMetricsProgressive(user.id, revenueRange)
    const people = await fetchPeople({ trainerId: user.id })
    const peopleById = new Map(people.map((p) => [p.id, p.name]))
    const [closeRate, showRate, averageBookings, mtdRevenue, trainedRevenue, newClients, newLeads, payments, tasks, sessions] =
      await Promise.all([
        bookings.closeRate,
        bookings.showRate,
        bookings.averageBookings,
        revenue.mtdRevenue,
        revenue.trainedRevenue,
        fetchNewClientsThisMonth(user.id),
        fetchNewLeadsThisMonth(user.id),
        fetchSuccessfulPaymentsThisMonth(user.id),
        fetchOpenTasks(user.id, 8),
        fetchSessions(user.id),
      ])
    const upcoming = sessions
      .filter((s) => s.start_time && new Date(s.start_time) >= new Date() && s.status === 'pending')
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())
      .slice(0, 6)
      .map((s) => ({ ...s, personName: s.person_id ? peopleById.get(s.person_id) : undefined }))
    return {
      closeRate,
      showRate,
      averageBookings,
      mtdRevenue,
      trainedRevenue,
      newClients,
      newLeads,
      payments,
      tasks,
      upcoming,
    }
  }, [user?.id])

  if (loading && !data) {
    return (
      <Screen title="Dashboard">
        <Loading />
      </Screen>
    )
  }

  return (
    <Screen title="Dashboard" subtitle="Same metrics as web /dash" onRefresh={reload}>
      <ErrorText text={error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Metric label="Close rate" value={data?.closeRate != null ? `${Math.round(data.closeRate * 100)}%` : null} />
        <Metric label="Show rate" value={data?.showRate != null ? `${Math.round(data.showRate * 100)}%` : null} />
        <Metric label="Avg bookings today" value={data?.averageBookings != null ? data.averageBookings.toFixed(1) : null} />
        <Metric label="MTD revenue" value={data?.mtdRevenue != null ? `$${Math.round(data.mtdRevenue)}` : null} />
        <Metric label="Trained revenue" value={data?.trainedRevenue != null ? `$${Math.round(data.trainedRevenue)}` : null} />
        <Metric label="New clients" value={data?.newClients ?? null} />
        <Metric label="New leads" value={data?.newLeads ?? null} />
        <Metric label="Payments this month" value={data?.payments ?? null} />
      </View>
      <Card>
        {data?.upcoming?.length ? (
          data.upcoming.map((s) => (
            <View key={s.id} style={{ marginBottom: 10 }}>
              <Metric
                label={s.type}
                value={`${s.personName ?? 'Open'} · ${s.start_time ? format(new Date(s.start_time), 'EEE h:mm a') : 'TBD'}`}
              />
            </View>
          ))
        ) : (
          <Empty text="No upcoming sessions" />
        )}
      </Card>
      <Card>
        {data?.tasks?.length ? (
          data.tasks.map((t) => (
            <View key={t.id} style={{ marginBottom: 8 }}>
              <Metric label={t.kind} value={t.person_name ?? t.service_name ?? t.status} />
            </View>
          ))
        ) : (
          <Empty text="No open tasks" />
        )}
      </Card>
    </Screen>
  )
}
