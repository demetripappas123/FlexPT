import { router, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { Text } from 'react-native'
import { Card, Empty, ErrorText, ListRow, Loading, PrimaryButton, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPersonWithData } from '@/src/api/fetches/fetchpersonwithdata'
import { fetchAssignedMeals } from '@/src/api/fetches/fetchassignedmeals'
import { fetchCheckinFormAssignments } from '@/src/api/fetches/fetchcheckinformassignments'

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!id) return null
    const [bundle, meals, checkins] = await Promise.all([
      fetchPersonWithData(id, user?.id),
      fetchAssignedMeals(id).catch(() => []),
      fetchCheckinFormAssignments(id).catch(() => []),
    ])
    return { ...bundle, meals, checkins }
  }, [id, user?.id])

  const person = data?.person
  const isClient = Boolean(person?.converted_at)

  return (
    <Screen title={person?.name ?? 'Person'} subtitle={isClient ? 'Client' : 'Prospect'} onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {person ? (
        <Card>
          <Text style={{ color: colors.muted }}>{person.number || 'No phone'}</Text>
          <Text style={{ color: colors.muted }}>{person.email || 'No email'}</Text>
          <Text style={{ color: colors.muted }}>{person.lead_source || 'No lead source'}</Text>
          {person.notes ? <Text style={{ color: colors.text, marginTop: 8 }}>{person.notes}</Text> : null}
          {isClient ? (
            <PrimaryButton label="Message" onPress={() => router.push(`/(trainer)/chat/${person.id}`)} />
          ) : null}
          {!isClient ? (
            <PrimaryButton
              label="Assign package to convert"
              onPress={() => router.push(`/(trainer)/conversion/${person.id}`)}
            />
          ) : null}
        </Card>
      ) : null}

      <Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Workouts</Text>
      {(data?.workouts ?? []).map((w) => (
        <ListRow
          key={w.id}
          title={w.workout_date ? format(new Date(w.workout_date), 'MMM d') : 'Workout'}
          subtitle={w.completed ? 'Completed' : 'Assigned'}
          meta={`${w.exercises?.length ?? 0} exercises`}
        />
      ))}
      {!data?.workouts?.length ? <Empty text="No assigned workouts — assign a program day from web or add that flow next" /> : null}

      <Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Sessions</Text>
      {(data?.sessions ?? []).map((s) => (
        <ListRow
          key={s.id}
          title={s.type}
          subtitle={s.status}
          meta={s.start_time ? format(new Date(s.start_time), 'MMM d, h:mm a') : null}
          onPress={() => router.push(`/(trainer)/events/${s.id}`)}
        />
      ))}

      <Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Meals</Text>
      {(data?.meals ?? []).map((m) => (
        <ListRow key={m.id} title={m.name || m.meal_name || 'Meal'} subtitle={m.status} meta={m.assigned_date} />
      ))}

      <Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Contracts / payments</Text>
      {(data?.contracts ?? []).map((c) => (
        <ListRow key={c.id} title={c.name ?? c.status ?? 'Contract'} subtitle={c.start_date} />
      ))}
      {(data?.payments ?? []).map((p) => (
        <ListRow key={p.id} title={`$${p.amount}`} subtitle={p.status} meta={p.payment_date} />
      ))}

      <Text style={{ color: colors.text, fontWeight: '700', marginVertical: 8 }}>Check-ins</Text>
      {(data?.checkins ?? []).map((a) => (
        <ListRow key={a.id} title={a.name} subtitle={`${a.status} · ${a.assigned_date}`} />
      ))}
    </Screen>
  )
}
