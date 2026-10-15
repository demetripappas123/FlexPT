import { useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { Alert, Text } from 'react-native'
import { Card, Empty, ErrorText, ListRow, Loading, PrimaryButton, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchSessionById, fetchSessionWithExercises } from '@/src/api/fetches/fetchsessions'
import { fetchPersonById } from '@/src/api/fetches/fetchpeople'
import {
  markSessionCancelled,
  markSessionMissed,
  sessionMissedLabel,
  suggestMissedSessions,
} from '@/src/api/utils/sessionMissed'

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!id) return null
    const raw = (await fetchSessionWithExercises(id)) ?? (await fetchSessionById(id))
    if (!raw) return null
    const [session] = await suggestMissedSessions([raw])
    const person = session.person_id ? await fetchPersonById(session.person_id) : null
    return { session, person }
  }, [id])

  const session = data?.session
  const exercises =
    session && 'exercises' in session && Array.isArray(session.exercises) ? session.exercises : []

  return (
    <Screen title={data?.person?.name ?? 'Session'} onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {session ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{session.type}</Text>
          <Text style={{ color: session.missed === 'suggested' ? colors.warning : colors.muted }}>
            {sessionMissedLabel(session) ?? session.status}
          </Text>
          <Text style={{ color: colors.muted }}>
            {session.start_time ? format(new Date(session.start_time), 'PPpp') : 'Unscheduled'}
          </Text>
          {session.status === 'pending' ? (
            <>
              <PrimaryButton
                label="Mark as missed"
                onPress={() =>
                  Alert.alert('Mark as missed', 'Charge a package unit for this no-show?', [
                    { text: 'With charge', onPress: () => markSessionMissed(session, true).then(reload) },
                    { text: 'Without charge', onPress: () => markSessionMissed(session, false).then(reload) },
                    { text: 'Back', style: 'cancel' },
                  ])
                }
              />
              <PrimaryButton
                label="Cancel session"
                onPress={() =>
                  Alert.alert('Cancel session', 'Cancel this session?', [
                    { text: 'With charge', onPress: () => markSessionCancelled(session, true).then(reload) },
                    { text: 'Without charge', onPress: () => markSessionCancelled(session, false).then(reload) },
                    { text: 'Back', style: 'cancel' },
                  ])
                }
              />
            </>
          ) : null}
        </Card>
      ) : null}
      {exercises.map((ex) => (
        <ListRow
          key={ex.id}
          title={ex.exercise_name ?? 'Exercise'}
          subtitle={ex.notes}
          meta={`${ex.sets?.length ?? 0} sets`}
        />
      ))}
      {!loading && !session ? <Empty text="Session not found" /> : null}
    </Screen>
  )
}
