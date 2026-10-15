import { useState } from 'react'
import { router } from 'expo-router'
import { Card, Empty, ErrorText, Field, ListRow, Loading, PrimaryButton, Screen, SearchBox } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchProspects } from '@/src/api/fetches/fetchpeople'
import { upsertPerson } from '@/src/api/upserts/upsertperson'

export default function ProspectsScreen() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchProspects(user.id)
  }, [user?.id])

  const rows = (data ?? []).filter((p) =>
    `${p.name} ${p.number ?? ''} ${p.lead_source ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  const addProspect = async () => {
    if (!name.trim() || !user) return
    await upsertPerson({ name: name.trim(), number: number.trim() }, { asClient: false, trainerId: user.id })
    setName('')
    setNumber('')
    reload()
  }

  return (
    <Screen title="Prospects" subtitle="people with no converted_at" onRefresh={reload}>
      <ErrorText text={error} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search prospects" />
      <Card>
        <Field label="New prospect name" value={name} onChangeText={setName} />
        <Field label="Phone" value={number} onChangeText={setNumber} keyboardType="phone-pad" />
        <PrimaryButton label="Add prospect" onPress={addProspect} disabled={!name.trim()} />
      </Card>
      {loading && !data ? <Loading /> : null}
      {!loading && rows.length === 0 ? <Empty text="No prospects yet" /> : null}
      {rows.map((p) => (
        <ListRow
          key={p.id}
          title={p.name}
          subtitle={[p.number, p.lead_source, p.notes].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/(trainer)/people/${p.id}`)}
        />
      ))}
    </Screen>
  )
}
