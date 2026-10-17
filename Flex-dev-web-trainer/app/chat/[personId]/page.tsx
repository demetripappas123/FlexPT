'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/authcontext'
import { ChatMessage, fetchChatMessages, subscribeToChatMessages } from '@/supabase/fetches/fetchchat'
import { fetchPersonById } from '@/supabase/fetches/fetchpeople'
import { getOrCreateChatConversation, sendChatMessage } from '@/supabase/upserts/upsertchat'

function formatTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function TrainerChatThreadPage() {
  const params = useParams()
  const personId = typeof params.personId === 'string' ? params.personId : ''
  const { user } = useAuth()
  const [personName, setPersonName] = useState('Client')
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
          setError('Could not open this chat. Only converted clients can be messaged.')
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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open chat')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [user?.id, personId])

  const send = async (event: FormEvent) => {
    event.preventDefault()
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background text-foreground">
      <div className="border-b border-border px-6 py-4">
        <Link href="/chat" className="text-sm text-muted-foreground hover:text-foreground">
          ← All chats
        </Link>
        <h1 className="mt-2 text-[22px] font-normal tracking-tight">{personName}</h1>
        <p className="text-sm text-muted-foreground">Client thread — only you and this client.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
        {loading && <p className="text-sm text-muted-foreground">Loading messages...</p>}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {!loading && messages.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_role === 'trainer'
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message your client"
            maxLength={4000}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending || !conversationId}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
