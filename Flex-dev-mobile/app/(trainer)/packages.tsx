import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPackages } from '@/src/api/fetches/fetchpackages'

export default function PackagesScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    const rows = await fetchPackages()
    return user ? rows.filter((p) => !p.trainer_id || p.trainer_id === user.id) : rows
  }, [user?.id])

  return (
    <Screen title="Packages" subtitle="Billing templates" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((p) => (
        <ListRow
          key={p.id}
          title={p.name ?? 'Untitled package'}
          subtitle={p.description}
          meta={
            p.pif
              ? `PIF $${p.pif_cost ?? 0}`
              : p.cost_per_bill_cycle != null
                ? `$${p.cost_per_bill_cycle}/cycle`
                : null
          }
        />
      ))}
      {!loading && !data?.length ? <Empty text="No packages" /> : null}
    </Screen>
  )
}
