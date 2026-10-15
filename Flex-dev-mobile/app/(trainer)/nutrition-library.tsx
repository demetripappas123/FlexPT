import { useState } from 'react'
import { router } from 'expo-router'
import { Empty, ErrorText, ListRow, Loading, Screen, SearchBox } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchNutritionPrograms } from '@/src/api/fetches/fetchnutritionprograms'
import { searchFoods } from '@/src/api/fetches/searchcatalog'

export default function NutritionLibraryScreen() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [programs, foods] = await Promise.all([
      user ? fetchNutritionPrograms(user.id) : Promise.resolve([]),
      searchFoods({ query: query || 'chicken', trainerId: user?.id, limit: 25 }),
    ])
    return { programs, foods }
  }, [user?.id, query])

  return (
    <Screen title="Nutrition" subtitle="Programs and food catalog" onRefresh={reload}>
      <ErrorText text={error} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search foods" />
      {loading && !data ? <Loading /> : null}
      {(data?.programs ?? []).map((p) => (
        <ListRow
          key={p.id}
          title={p.name}
          subtitle="Nutrition program"
          onPress={() => router.push(`/(trainer)/nutrition/${p.id}`)}
        />
      ))}
      {(data?.foods ?? []).map((f) => (
        <ListRow key={f.id} title={f.description} subtitle={f.brand_name ?? f.category} meta={f.source} />
      ))}
      {!loading && !data?.programs.length && !data?.foods.length ? <Empty text="Nothing here" /> : null}
    </Screen>
  )
}
