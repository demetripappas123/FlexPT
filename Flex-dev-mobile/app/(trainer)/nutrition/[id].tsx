import { useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { Card, Empty, ErrorText, Loading, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchNutritionPrograms } from '@/src/api/fetches/fetchnutritionprograms'
import { fetchNutritionWeeks } from '@/src/api/fetches/fetchnutritionweeks'

export default function NutritionProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!id) return null
    const [programs, weeks] = await Promise.all([fetchNutritionPrograms(), fetchNutritionWeeks(id)])
    return {
      program: programs.find((p) => p.id === id),
      weeks,
    }
  }, [id])

  return (
    <Screen title={data?.program?.name ?? 'Nutrition program'} onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {(data?.weeks ?? []).map((week) => (
        <Card key={week.id}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Week {week.week_number}</Text>
          {(week.days ?? []).map((day) => (
            <Text key={day.id} style={{ color: colors.muted, marginBottom: 6 }}>
              {day.day_of_week ?? day.id}
              {(day.meals ?? []).length ? ` · ${day.meals.length} meals` : ''}
            </Text>
          ))}
        </Card>
      ))}
      {!loading && !data?.weeks.length ? <Empty text="No nutrition weeks" /> : null}
    </Screen>
  )
}
