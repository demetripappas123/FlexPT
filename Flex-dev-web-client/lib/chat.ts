import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ChatConversation = {
  id: string
  trainer_id: string
  person_id: string
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_role: 'trainer' | 'client'
  sender_user_id: string
  body: string
  created_at: string
}

export async function getOrCreateClientConversation(
  trainerId: string,
  personId: string
): Promise<ChatConversation> {
  const { data: existing, error: existingError } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('person_id', personId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing as ChatConversation

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ trainer_id: trainerId, person_id: personId })
    .select()
    .single()

  if (error?.code === '23505') {
    const { data: again, error: againError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('person_id', personId)
      .single()
    if (againError) throw againError
    return again as ChatConversation
  }

  if (error) throw error
  return data as ChatConversation
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

  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export async function sendChatMessage(input: {
  conversationId: string
  senderUserId: string
  body: string
}): Promise<ChatMessage | null> {
  const body = input.body.trim()
  if (!body) return null

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: input.conversationId,
      sender_role: 'client',
      sender_user_id: input.senderUserId,
      body,
    })
    .select()
    .single()

  if (error) throw error
  return data as ChatMessage
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
