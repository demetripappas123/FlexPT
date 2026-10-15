import { format } from 'date-fns'
import { Empty, ErrorText, ListRow, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPayments } from '@/src/api/fetches/fetchpayments'

export default function PaymentsScreen() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    return fetchPayments(user?.id)
  }, [user?.id])

  return (
    <Screen title="Payments" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((p) => (
        <ListRow
          key={p.id}
          title={`$${p.amount ?? 0}`}
          subtitle={`${p.status} · ${p.payment_type}`}
          meta={p.payment_date ? format(new Date(p.payment_date), 'MMM d') : null}
        />
      ))}
      {!loading && !data?.length ? <Empty text="No payments" /> : null}
    </Screen>
  )
}
