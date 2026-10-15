import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Card, Empty, ErrorText, Field, ListRow, Loading, PrimaryButton, Screen, SearchBox } from '@/components/ui'
import { colors, space } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import {
  fetchClientRoster,
  ClientRosterFilter,
  CLIENT_ROSTER_FILTERS,
  matchesClientRosterFilter,
  countClientRosterFilters,
} from '@/src/api/fetches/fetchclientroster'
import { upsertPerson } from '@/src/api/upserts/upsertperson'

export default function ClientsScreen() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClientRosterFilter>('all')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchClientRoster(user.id)
  }, [user?.id])

  const filterCounts = countClientRosterFilters(data ?? [])
  const rows = (data ?? []).filter((row) => {
    if (!matchesClientRosterFilter(row, filter)) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${row.name} ${row.number ?? ''} ${row.status} ${row.inOnboarding ? 'onboarding' : ''}`.toLowerCase().includes(q)
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CLIENT_ROSTER_FILTERS.map((item) => {
            const selected = filter === item.id
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.accent : colors.card,
                }}
              >
                <Text style={{ color: selected ? colors.bg : colors.muted, fontSize: 12, fontWeight: '600' }}>
                  {item.label} {filterCounts[item.id]}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
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
          subtitle={[row.inOnboarding ? 'onboarding' : row.status, row.number].filter(Boolean).join(' · ')}
          meta={
            row.compliance.percent == null
              ? row.nextSessionAt
                ? 'Upcoming'
                : 'Open'
              : `${row.compliance.percent}%`
          }
          onPress={() => router.push(`/(trainer)/people/${row.id}`)}
        />
      ))}
    </Screen>
  )
}
