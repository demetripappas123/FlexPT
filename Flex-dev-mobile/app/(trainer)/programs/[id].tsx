import { useLocalSearchParams } from 'expo-router'
import { Card, Empty, ErrorText, Loading, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPrograms } from '@/src/api/fetches/fetchprograms'
import { fetchWeeks } from '@/src/api/fetches/fetchweek'
import { fetchDayExercises } from '@/src/api/fetches/fetchdayexercises'
import { Text } from 'react-native'
import { colors } from '@/constants/theme'

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!id || !user) return null
    const [programs, weeks] = await Promise.all([fetchPrograms(user.id), fetchWeeks(id, user.id)])
    const program = programs.find((p) => p.id === id) ?? { id, name: 'Program' }
    const days = await Promise.all(
      weeks.flatMap((week) =>
        week.days.map(async (day) => ({
          week: week.number,
          day,
          exercises: await fetchDayExercises(day.id, user.id),
        }))
      )
    )
    return { program, days }
  }, [id, user?.id])

  return (
    <Screen title={data?.program.name ?? 'Program'} onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data?.days ?? []).map(({ week, day, exercises }) => (
        <Card key={day.id}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>
            Week {week} · {day.name}
          </Text>
          {exercises.length === 0 ? <Empty text="No exercises on this day" /> : null}
          {exercises.map((ex) => (
            <Text key={`${ex.day_id}-${ex.exercise_def_id}`} style={{ color: colors.muted, marginBottom: 4 }}>
              {ex.exercise_name}
              {ex.sets ? ` · ${ex.sets} sets` : ''}
              {ex.reps ? ` · ${ex.reps}` : ''}
            </Text>
          ))}
        </Card>
      ))}
      {!loading && data && data.days.length === 0 ? <Empty text="No weeks yet — edit this on web or via the AI editor" /> : null}
    </Screen>
  )
}
