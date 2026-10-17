'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { fetchTrainerConversations, ChatConversation } from '@/supabase/fetches/fetchchat'
import { fetchClients, Client } from '@/supabase/fetches/fetchpeople'

function formatWhen(value: string | null) {
  if (!value) return 'No messages yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ChatInboxPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [threads, roster] = await Promise.all([
          fetchTrainerConversations(user.id),
          fetchClients(user.id),
        ])
        if (!cancelled) {
          setConversations(threads)
          setClients(roster)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chats')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const startedIds = useMemo(() => new Set(conversations.map((c) => c.person_id)), [conversations])
  const unstarted = clients.filter((c) => !startedIds.has(c.id))

  return (
    <div className="text-foreground">
      <h1 className="text-[26px] font-normal tracking-tight">Chat</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Message any of your clients. Each client only talks to you.
      </p>

      {loading && <p className="text-sm text-muted-foreground">Loading chats...</p>}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && conversations.length === 0 && unstarted.length === 0 && (
        <p className="text-sm text-muted-foreground">No clients to message yet.</p>
      )}

      <div className="space-y-2">
        {conversations.map((thread) => (
          <Link
            key={thread.id}
            href={`/chat/${thread.person_id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/40"
          >
            <div>
              <p className="font-medium">{thread.person_name || 'Client'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {thread.last_message_preview || 'No messages yet'}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{formatWhen(thread.last_message_at)}</span>
          </Link>
        ))}
      </div>

      {unstarted.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Start a chat</h2>
          <div className="space-y-2">
            {unstarted.map((client) => (
              <Link
                key={client.id}
                href={`/chat/${client.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted/40"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{client.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
