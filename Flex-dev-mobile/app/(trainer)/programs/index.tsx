import { useState } from 'react'
import { router } from 'expo-router'
import { Card, Empty, ErrorText, Field, ListRow, Loading, PrimaryButton, Screen } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { fetchPrograms } from '@/src/api/fetches/fetchprograms'
import { supabase } from '@/src/api/supabase'

export default function ProgramsScreen() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user) return []
    return fetchPrograms(user.id)
  }, [user?.id])

  const add = async () => {
    if (!name.trim() || !user) return
    const { error: insertError } = await supabase.from('programs').insert({
      name: name.trim(),
      trainer_id: user.id,
    })
    if (insertError) throw insertError
    setName('')
    reload()
  }

  return (
    <Screen title="Programs" subtitle="Templates the AI editor also uses" onRefresh={reload}>
      <ErrorText text={error} />
      <Card>
        <Field label="New program name" value={name} onChangeText={setName} />
        <PrimaryButton label="Add program" onPress={add} disabled={!name.trim()} />
      </Card>
      {loading && !data ? <Loading /> : null}
      {(data ?? []).map((p) => (
        <ListRow
          key={p.id}
          title={p.name}
          onPress={() => p.id && router.push(`/(trainer)/programs/${p.id}`)}
        />
      ))}
      {!loading && !data?.length ? <Empty text="No programs" /> : null}
    </Screen>
  )
}
