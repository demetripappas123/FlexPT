import { router } from 'expo-router'
import { format } from 'date-fns'
import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchEvents } from '@/src/api/fetches/fetchevents'
import { fetchSessions } from '@/src/api/fetches/fetchsessions'
import { fetchPeople } from '@/src/api/fetches/fetchpeople'

export default function CalendarScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return { sessions: [], events: [] }
    const [sessions, events, people] = await Promise.all([
      fetchSessions(user.id),
      fetchEvents().catch(() => []),
      fetchPeople({ trainerId: user.id }),
    ])
    const names = new Map(people.map((p) => [p.id, p.name]))
    return {
      sessions: sessions
        .slice()
        .sort((a, b) => new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime()),
      events,
      names,
    }
  }, [user?.id])

  return (
    <Screen title="Calendar" subtitle="Sessions and events" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data?.sessions ?? []).map((s) => (
        <ListRow
          key={s.id}
          title={s.person_id ? data?.names?.get(s.person_id) ?? s.type : s.type}
          subtitle={`${s.type} · ${s.status}`}
          meta={s.start_time ? format(new Date(s.start_time), 'MMM d, h:mm a') : 'Unscheduled'}
          onPress={() => router.push(`/(trainer)/events/${s.id}`)}
        />
      ))}
      {(data?.events ?? []).map((e) => (
        <ListRow
          key={e.id}
          title={e.title}
          subtitle={e.status}
          meta={format(new Date(e.start_time), 'MMM d, h:mm a')}
        />
      ))}
      {!loading && !data?.sessions.length && !data?.events.length ? <Empty text="Nothing on the calendar" /> : null}
    </Screen>
  )
}
