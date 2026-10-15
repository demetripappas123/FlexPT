import React, { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, space } from '@/constants/theme'

export function Screen({
  title,
  subtitle,
  children,
  onRefreshLabel,
  onRefresh,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onRefreshLabel?: string
  onRefresh?: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + 32 }}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onRefresh ? (
          <Pressable onPress={onRefresh} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>{onRefreshLabel ?? 'Refresh'}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </ScrollView>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function ListRow({
  title,
  subtitle,
  meta,
  onPress,
}: {
  title: string
  subtitle?: string | null
  meta?: string | null
  onPress?: () => void
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
    </Pressable>
  )
}

export function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value ?? '—'}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

export function ErrorText({ text }: { text: string | null }) {
  if (!text) return null
  return <Text style={styles.error}>{text}</Text>
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboardType,
  placeholder,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  secure?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad'
  placeholder?: string
}) {
  return (
    <View style={{ marginBottom: space.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={styles.input}
      />
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primary, disabled && { opacity: 0.5 }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? 'Search'}
      placeholderTextColor={colors.muted}
      style={[styles.input, { marginBottom: space.md }]}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.sm,
  },
  row: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.muted, marginTop: 4, fontSize: 13 },
  rowMeta: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  metric: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.sm,
  },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  metricLabel: { color: colors.muted, marginTop: 4, fontSize: 12 },
  empty: { color: colors.muted, paddingVertical: space.lg },
  center: { paddingVertical: 40, alignItems: 'center' },
  error: { color: colors.danger, marginBottom: space.sm },
  fieldLabel: { color: colors.muted, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  primaryText: { color: '#0c0d10', fontWeight: '700', fontSize: 16 },
  ghostBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ghostBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
})
