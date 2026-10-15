import { Redirect } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { isClientRole } from '@/src/api/auth/auth-helpers'
import { colors } from '@/constants/theme'

const hidden = { drawerItemStyle: { display: 'none' as const } }

export default function TrainerLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!user || isClientRole(user)) return <Redirect href="/login" />

  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        drawerStyle: { backgroundColor: colors.card },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen name="dash" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="clients" options={{ title: 'Clients' }} />
      <Drawer.Screen name="chat/index" options={{ title: 'Chat' }} />
      <Drawer.Screen name="prospects" options={{ title: 'Prospects' }} />
      <Drawer.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Drawer.Screen name="packages" options={{ title: 'Packages' }} />
      <Drawer.Screen name="payments" options={{ title: 'Payments' }} />
      <Drawer.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Drawer.Screen name="programs/index" options={{ title: 'Programs' }} />
      <Drawer.Screen name="workout-library" options={{ title: 'Workouts' }} />
      <Drawer.Screen name="exercises" options={{ title: 'Exercises' }} />
      <Drawer.Screen name="nutrition-library" options={{ title: 'Nutrition' }} />
      <Drawer.Screen name="checkin-forms" options={{ title: 'Check-in forms' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="people/[id]" options={{ title: 'Person', ...hidden }} />
      <Drawer.Screen name="chat/[personId]" options={{ title: 'Thread', ...hidden }} />
      <Drawer.Screen name="programs/[id]" options={{ title: 'Program', ...hidden }} />
      <Drawer.Screen name="nutrition/[id]" options={{ title: 'Nutrition program', ...hidden }} />
      <Drawer.Screen name="events/[id]" options={{ title: 'Event', ...hidden }} />
      <Drawer.Screen name="conversion/[id]" options={{ title: 'Conversion', ...hidden }} />
      <Drawer.Screen name="trainer/[id]/goals" options={{ title: 'Trainer goals', ...hidden }} />
    </Drawer>
  )
}
