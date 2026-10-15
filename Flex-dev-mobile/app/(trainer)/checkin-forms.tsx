import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchCheckinForms } from '@/src/api/fetches/fetchcheckinforms'

export default function CheckinFormsScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchCheckinForms(user.id)
  }, [user?.id])

  return (
    <Screen title="Check-in forms" subtitle="Templates assigned from the client page" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((form) => (
        <ListRow key={form.id} title={form.name} subtitle={form.description} />
      ))}
      {!loading && !data?.length ? <Empty text="No check-in forms" /> : null}
    </Screen>
  )
}
