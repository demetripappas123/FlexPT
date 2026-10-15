import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ErrorText, Loading } from '@/components/ui'
import { colors, space } from '@/constants/theme'
import { useAuth } from '@/context/AuthContext'
import { ChatMessage, fetchChatMessages, subscribeToChatMessages } from '@/src/api/fetches/fetchchat'
import { fetchPersonById } from '@/src/api/fetches/fetchpeople'
import { getOrCreateChatConversation, sendChatMessage } from '@/src/api/upserts/upsertchat'

function formatTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChatThreadScreen() {
  const { personId } = useLocalSearchParams<{ personId: string }>()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [personName, setPersonName] = useState('Client')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !personId) return
    let cancelled = false
    let channel: ReturnType<typeof subscribeToChatMessages> | null = null

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [person, conversation] = await Promise.all([
          fetchPersonById(personId),
          getOrCreateChatConversation(user.id, personId),
        ])
        if (cancelled) return
        if (person) setPersonName(person.name)
        if (!conversation) {
          setError('Could not open this chat.')
          return
        }
        setConversationId(conversation.id)
        const rows = await fetchChatMessages(conversation.id)
        if (cancelled) return
        setMessages(rows)
        channel = subscribeToChatMessages(conversation.id, (message) => {
          setMessages((prev) => (prev.some((row) => row.id === message.id) ? prev : [...prev, message]))
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to open chat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      channel?.unsubscribe()
    }
  }, [user?.id, personId])

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages.length])

  const send = async () => {
    if (!user?.id || !conversationId || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const sent = await sendChatMessage({
        conversationId,
        senderRole: 'trainer',
        senderUserId: user.id,
        body: draft,
      })
      setDraft('')
      if (sent) {
        setMessages((prev) => (prev.some((row) => row.id === sent.id) ? prev : [...prev, sent]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{personName}</Text>
        <Text style={{ color: colors.muted, marginBottom: space.sm }}>Client thread</Text>
        <ErrorText text={error} />
      </View>
      {loading ? <Loading /> : null}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.md, paddingBottom: space.lg }}
      >
        {messages.map((message) => {
          const mine = message.sender_role === 'trainer'
          return (
            <View
              key={message.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? colors.accent : colors.card,
                borderColor: colors.border,
                borderWidth: mine ? 0 : 1,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 8,
                maxWidth: '80%',
              }}
            >
              <Text style={{ color: mine ? '#0c0d10' : colors.text }}>{message.body}</Text>
              <Text style={{ color: mine ? '#0c0d10' : colors.muted, fontSize: 11, marginTop: 4 }}>
                {formatTime(message.created_at)}
              </Text>
            </View>
          )
        })}
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: space.md,
          paddingBottom: insets.bottom + space.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your client"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            color: colors.text,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending || !conversationId}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 10,
            paddingHorizontal: 16,
            justifyContent: 'center',
            opacity: !draft.trim() || sending || !conversationId ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#0c0d10', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
