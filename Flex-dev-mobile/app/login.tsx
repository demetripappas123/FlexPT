import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { Field, PrimaryButton, ErrorText } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { colors, space } from '@/constants/theme'
import { isClientRole, signIn, signOut } from '@/src/api/auth/auth-helpers'
import { supabase } from '@/src/api/supabase'

export default function LoginScreen() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user && !isClientRole(user)) {
    return <Redirect href="/dash" />
  }

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const { data, error: signError } = await signIn(email.trim(), password)
      if (signError) {
        setError(signError.message || 'Failed to sign in')
        return
      }
      if (!data?.user) return
      if (isClientRole(data.user)) {
        await signOut()
        setError('This is a client login. Use the client app.')
        return
      }
      const { data: trainer, error: trainerError } = await supabase
        .from('trainers')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      if (trainerError || !trainer) {
        await signOut()
        setError('This account is not a trainer.')
        return
      }
      router.replace('/dash')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.lg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 8 }}>FlexPT</Text>
      <Text style={{ color: colors.muted, marginBottom: space.lg }}>Trainer sign in</Text>
      <ErrorText text={error} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@studio.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secure />
      <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
      <View style={{ height: 16 }} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>* Only approved trainer accounts can sign in.</Text>
    </KeyboardAvoidingView>
  )
}
