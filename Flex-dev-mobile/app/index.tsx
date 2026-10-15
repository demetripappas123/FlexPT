import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { isClientRole } from '@/src/api/auth/auth-helpers'
import { colors } from '@/constants/theme'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!user || isClientRole(user)) return <Redirect href="/login" />
  return <Redirect href="/dash" />
}
