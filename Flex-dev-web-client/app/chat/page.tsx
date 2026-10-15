'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import AuthGate from '@/components/auth-gate'
import AppShell from '@/components/app-shell'
import { useAuth } from '@/context/auth-context'
import { fetchLinkedPerson } from '@/lib/person'
import {
  ChatMessage,
  fetchChatMessages,
  getOrCreateClientConversation,
  sendChatMessage,
  subscribeToChatMessages,
} from '@/lib/chat'

function formatTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ClientChatPage() {
  return (
    <AuthGate>
      <AppShell>
        <ClientChat />
      </AppShell>
    </AuthGate>
  )
}

function ClientChat() {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let channel: ReturnType<typeof subscribeToChatMessages> | null = null

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const person = await fetchLinkedPerson(user.id)
        if (!person) {
          if (!cancelled) setError('No client profile is linked to this login yet.')
          return
        }
        if (!person.trainer_id) {
          if (!cancelled) setError('You are not assigned to a trainer yet.')
          return
        }
        const conversation = await getOrCreateClientConversation(person.trainer_id, person.id)
        if (cancelled) return
        setConversationId(conversation.id)
        const rows = await fetchChatMessages(conversation.id)
        if (cancelled) return
        setMessages(rows)
        channel = subscribeToChatMessages(conversation.id, (message) => {
          setMessages((prev) => (prev.some((row) => row.id === message.id) ? prev : [...prev, message]))
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (channel) channel.unsubscribe()
    }
  }, [user])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !conversationId || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const sent = await sendChatMessage({
        conversationId,
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
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Chat</h1>
      <p className="mb-6 text-sm text-stone-600">Messages with your trainer only.</p>

      {loading && <p className="text-sm text-stone-600">Loading chat...</p>}
      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="min-h-[360px] space-y-3 rounded-lg border border-stone-200 bg-white p-4">
        {!loading && messages.length === 0 && !error && (
          <p className="text-sm text-stone-600">No messages yet. Your trainer will see anything you send here.</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_role === 'client'
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  mine ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-900'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-stone-300' : 'text-stone-500'}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message your trainer"
          maxLength={4000}
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending || !conversationId}
          className="cursor-pointer rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
