'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { supabase } from '@/supabase/supabaseClient'
import { fetchTrainerConversations, ChatConversation } from '@/supabase/fetches/fetchchat'
import { fetchClients, Client } from '@/supabase/fetches/fetchpeople'
import ProgramChat from '@/modules/programs/programchat'

type PanelTab = 'assistant' | 'chats'

type AssistantPanelProps = {
  programId: string | null
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onNavigate: () => void
}

function formatWhen(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AssistantPanel({ programId, tab, onTabChange, onNavigate }: AssistantPanelProps) {
  const { user } = useAuth()
  const [programName, setProgramName] = useState('Program')
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loadingChats, setLoadingChats] = useState(false)

  useEffect(() => {
    if (!programId) return
    let cancelled = false
    supabase
      .from('programs')
      .select('name')
      .eq('id', programId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.name) setProgramName(data.name)
      })
    return () => {
      cancelled = true
    }
  }, [programId])

  useEffect(() => {
    if (tab !== 'chats' || !user?.id) return
    let cancelled = false
    setLoadingChats(true)
    Promise.all([fetchTrainerConversations(user.id), fetchClients(user.id)])
      .then(([threads, roster]) => {
        if (cancelled) return
        setConversations(threads)
        setClients(roster)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoadingChats(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, user?.id])

  const startedIds = useMemo(() => new Set(conversations.map((c) => c.person_id)), [conversations])
  const unstarted = clients.filter((client) => !startedIds.has(client.id))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => onTabChange('assistant')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === 'assistant' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Assistant
        </button>
        <button
          type="button"
          onClick={() => onTabChange('chats')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === 'chats' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Chats
        </button>
      </div>

      {tab === 'assistant' ? (
        programId ? (
          <div className="min-h-0 flex-1">
            <ProgramChat programId={programId} programName={programName} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Open a program to use the assistant.
          </div>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loadingChats && <p className="text-sm text-muted-foreground">Loading chats...</p>}
          {!loadingChats && conversations.length === 0 && unstarted.length === 0 && (
            <p className="text-sm text-muted-foreground">No clients to message yet.</p>
          )}
          <div className="space-y-2">
            {conversations.map((thread) => (
              <Link
                key={thread.id}
                href={`/chat/${thread.person_id}`}
                onClick={onNavigate}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{thread.person_name || 'Client'}</p>
                  <p className="truncate text-xs text-muted-foreground">{thread.last_message_preview || 'No messages yet'}</p>
                </div>
                <span className="ml-3 shrink-0 text-[11px] text-muted-foreground">{formatWhen(thread.last_message_at)}</span>
              </Link>
            ))}
            {unstarted.map((client) => (
              <Link
                key={client.id}
                href={`/chat/${client.id}`}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/60"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{client.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
