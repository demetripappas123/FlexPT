import { router } from 'expo-router'
import { Text } from 'react-native'
import { Card, PrimaryButton, Screen } from '@/components/ui'
import { colors } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/src/api/auth/auth-helpers'

export default function SettingsScreen() {
  const { user } = useAuth()

  return (
    <Screen title="Settings">
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>Account</Text>
        <Text style={{ color: colors.muted }}>{user?.email}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>Trainer id: {user?.id}</Text>
      </Card>
      {user?.id ? (
        <PrimaryButton label="Trainer goals" onPress={() => router.push(`/(trainer)/trainer/${user.id}/goals`)} />
      ) : null}
      <PrimaryButton
        label="Sign out"
        onPress={async () => {
          await signOut()
          router.replace('/login')
        }}
      />
    </Screen>
  )
}
