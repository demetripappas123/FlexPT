import { useState } from 'react'
import { Empty, ErrorText, ListRow, Loading, Screen, SearchBox } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { searchExercises } from '@/src/api/fetches/searchcatalog'
import { fetchExercises } from '@/src/api/fetches/fetchexlib'

export default function ExercisesScreen() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (query.trim()) return searchExercises({ query, trainerId: user?.id, limit: 40 })
    const base = await fetchExercises()
    return base.map((ex) => ({
      id: ex.id,
      name: ex.name,
      source: 'base' as const,
      movement_pattern: ex.movement_pattern,
    }))
  }, [query, user?.id])

  return (
    <Screen title="Exercises" subtitle="Trigram search over the catalog" onRefresh={reload}>
      <ErrorText text={error} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search exercises" />
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((ex) => (
        <ListRow key={ex.id} title={ex.name} subtitle={ex.movement_pattern} meta={ex.source} />
      ))}
      {!loading && !data?.length ? <Empty text="No matches" /> : null}
    </Screen>
  )
}
