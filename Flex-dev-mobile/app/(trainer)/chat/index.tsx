import { useMemo } from 'react'
import { router } from 'expo-router'
import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchTrainerConversations } from '@/src/api/fetches/fetchchat'
import { fetchClients } from '@/src/api/fetches/fetchpeople'

function formatWhen(value: string | null) {
  if (!value) return 'New'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ChatInboxScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return { conversations: [], clients: [] }
    const [conversations, clients] = await Promise.all([
      fetchTrainerConversations(user.id),
      fetchClients(user.id),
    ])
    return { conversations, clients }
  }, [user?.id])

  const startedIds = useMemo(
    () => new Set((data?.conversations ?? []).map((c) => c.person_id)),
    [data?.conversations]
  )
  const unstarted = (data?.clients ?? []).filter((c) => !startedIds.has(c.id))

  return (
    <Screen title="Chat" subtitle="Your clients only" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data?.conversations ?? []).map((thread) => (
        <ListRow
          key={thread.id}
          title={thread.person_name || 'Client'}
          subtitle={thread.last_message_preview || 'No messages yet'}
          meta={formatWhen(thread.last_message_at)}
          onPress={() => router.push(`/(trainer)/chat/${thread.person_id}`)}
        />
      ))}
      {unstarted.map((client) => (
        <ListRow
          key={client.id}
          title={client.name}
          subtitle="Start a chat"
          onPress={() => router.push(`/(trainer)/chat/${client.id}`)}
        />
      ))}
      {!loading && !(data?.conversations?.length || unstarted.length) ? (
        <Empty text="No clients to message yet" />
      ) : null}
    </Screen>
  )
}
