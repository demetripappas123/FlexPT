import { router, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { Text } from 'react-native'
import { Card, ErrorText, Loading, PrimaryButton, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPersonById } from '@/src/api/fetches/fetchpeople'

export default function ConversionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: person, loading, error } = useAsyncData(async () => {
    if (!id) return null
    return fetchPersonById(id)
  }, [id])

  return (
    <Screen title="Conversion" subtitle={person?.name}>
      <ErrorText text={error} />
      {loading && !person ? <Loading /> : null}
      {person ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{person.name}</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            {person.converted_at
              ? `Converted ${format(new Date(person.converted_at), 'PP')}`
              : 'Still a prospect. Assign a package on web to convert — not a session.'}
          </Text>
          <PrimaryButton label="Open person" onPress={() => router.push(`/(trainer)/people/${id}`)} />
        </Card>
      ) : null}
    </Screen>
  )
}
