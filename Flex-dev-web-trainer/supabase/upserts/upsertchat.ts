import { supabase } from '../supabaseClient'
import { ChatConversation, ChatMessage } from '../fetches/fetchchat'

export async function getOrCreateChatConversation(
  trainerId: string,
  personId: string
): Promise<ChatConversation | null> {
  const { data: existing, error: existingError } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('trainer_id', trainerId)
    .eq('person_id', personId)
    .maybeSingle()

  if (existingError) {
    console.error('Error finding conversation:', existingError)
    throw existingError
  }
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

  if (error) {
    console.error('Error creating conversation:', error)
    throw error
  }
  return data as ChatConversation
}

export async function sendChatMessage(input: {
  conversationId: string
  senderRole: 'trainer' | 'client'
  senderUserId: string
  body: string
}): Promise<ChatMessage | null> {
  const body = input.body.trim()
  if (!body) return null

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: input.conversationId,
      sender_role: input.senderRole,
      sender_user_id: input.senderUserId,
      body,
    })
    .select()
    .single()

  if (error) {
    console.error('Error sending message:', error)
    throw error
  }
  return data as ChatMessage
}
