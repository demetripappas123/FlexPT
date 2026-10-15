import { useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { Card, ErrorText, Loading, Metric, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAsyncData } from '@/hooks/useAsyncData'
import { supabase } from '@/src/api/supabase'

export default function TrainerGoalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!id) return null
    const { data: trainer, error: trainerError } = await supabase
      .from('trainers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (trainerError) throw trainerError
    return trainer
  }, [id])

  return (
    <Screen title="Trainer goals" onRefresh={reload}>
      <ErrorText text={error} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 12 }}>{data.name ?? 'Trainer'}</Text>
          <Metric label="Monthly revenue goal" value={data.monthly_revenue_goal} />
          <Metric label="Client goal" value={data.client_goal} />
          <Metric label="Trained hours goal" value={data.trained_hours_goal} />
          <Metric label="Daily booking goal" value={data.daily_booking_goal} />
          <Metric label="Commission %" value={data.commission_percentage} />
        </Card>
      ) : null}
    </Screen>
  )
}
