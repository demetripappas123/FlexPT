import { useState } from 'react'
import { router } from 'expo-router'
import { Card, Empty, ErrorText, Field, ListRow, Loading, PrimaryButton, Screen, SearchBox } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchClientRoster } from '@/src/api/fetches/fetchclientroster'
import { upsertPerson } from '@/src/api/upserts/upsertperson'

export default function ClientsScreen() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchClientRoster(user.id)
  }, [user?.id])

  const rows = (data ?? []).filter((row) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${row.name} ${row.number ?? ''} ${row.status}`.toLowerCase().includes(q)
  })

  const addClient = async () => {
    if (!name.trim() || !user) return
    await upsertPerson({ name: name.trim(), number: number.trim() }, { asClient: true, trainerId: user.id })
    setName('')
    setNumber('')
    reload()
  }

  return (
    <Screen title="Clients" subtitle="people.converted_at is set" onRefresh={reload}>
      <ErrorText text={error} />
      <SearchBox value={query} onChangeText={setQuery} placeholder="Search clients" />
      <Card>
        <Field label="New client name" value={name} onChangeText={setName} />
        <Field label="Phone" value={number} onChangeText={setNumber} keyboardType="phone-pad" />
        <PrimaryButton label="Add client" onPress={addClient} disabled={!name.trim()} />
      </Card>
      {loading && !data ? <Loading /> : null}
      {!loading && rows.length === 0 ? <Empty text="No clients yet" /> : null}
      {rows.map((row) => (
        <ListRow
          key={row.id}
          title={row.name}
          subtitle={[row.status, row.number].filter(Boolean).join(' · ')}
          meta={row.nextSessionAt ? 'Upcoming' : 'Open'}
          onPress={() => router.push(`/(trainer)/people/${row.id}`)}
        />
      ))}
    </Screen>
  )
}
