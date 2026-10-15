import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type ChatConversation = {
  id: string
  trainer_id: string
  person_id: string
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
  person_name?: string | null
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_role: 'trainer' | 'client'
  sender_user_id: string
  body: string
  created_at: string
}

export async function fetchTrainerConversations(trainerId: string): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, trainer_id, person_id, last_message_at, last_message_preview, created_at, people:person_id (name)')
    .eq('trainer_id', trainerId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    trainer_id: row.trainer_id,
    person_id: row.person_id,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    created_at: row.created_at,
    person_name: row.people?.name ?? null,
  }))
}

export async function fetchClientConversation(): Promise<ChatConversation | null> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching client conversation:', error)
    throw error
  }
  return data
}

export async function fetchChatMessages(
  conversationId: string,
  limit = 80
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching messages:', error)
    throw error
  }
  return (data ?? []) as ChatMessage[]
}

export function subscribeToChatMessages(
  conversationId: string,
  onInsert: (message: ChatMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe()
}
