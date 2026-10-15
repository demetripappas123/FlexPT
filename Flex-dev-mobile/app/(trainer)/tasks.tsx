import { router } from 'expo-router'
import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchOpenTasks, taskActionLabel } from '@/src/api/fetches/fetchtasks'

export default function TasksScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchOpenTasks(user.id, 100)
  }, [user?.id])

  return (
    <Screen title="Tasks" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((t) => (
        <ListRow
          key={t.id}
          title={t.person_name ?? taskActionLabel(t.kind)}
          subtitle={`${taskActionLabel(t.kind)} · ${t.status}`}
          meta={t.due_date}
          onPress={() => router.push(`/(trainer)/people/${t.person_id}`)}
        />
      ))}
      {!loading && !data?.length ? <Empty text="No open tasks" /> : null}
    </Screen>
  )
}
