import { supabase } from '../supabaseClient'

export interface AIConversation {
  id: string
  trainer_id: string
  person_id: string | null
  program_id: string | null
  status: 'active' | 'completed' | 'archived'
  system_prompt: string
  conversation_state: Record<string, any>
  summary: string | null
  summarycount: number
  last_user_message: string | null
  last_ai_message: string | null
  created_at: string
  updated_at: string
}

/**
 * Get or create an AI conversation for a program
 */
export async function getOrCreateConversation(
  trainerId: string,
  programId: string | null = null,
  personId: string | null = null,
  systemPrompt: string
): Promise<AIConversation> {
  // Try to find existing active conversation for this program
  // Ensure only one conversation per program by finding any active one
  if (programId) {
    const { data: existing, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('trainer_id', trainerId)
      .eq('program_id', programId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', fetchError)
    }

    if (existing) {
      // If multiple exist (shouldn't happen, but handle it), archive older ones
      const { data: otherConversations } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('trainer_id', trainerId)
        .eq('program_id', programId)
        .eq('status', 'active')
        .neq('id', existing.id)

      if (otherConversations && otherConversations.length > 0) {
        // Archive other active conversations for this program
        await supabase
          .from('ai_conversations')
          .update({ status: 'archived' })
          .in('id', otherConversations.map(c => c.id))
      }

      return existing as AIConversation
    }
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabase
    .from('ai_conversations')
    .insert({
      trainer_id: trainerId,
      program_id: programId,
      person_id: personId,
      system_prompt: systemPrompt,
      conversation_state: {},
      summary: null,
      summarycount: 0,
      status: 'active',
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating conversation:', createError)
    throw createError
  }

  return newConv as AIConversation
}

/**
 * Update conversation with new messages and state
 */
export async function updateConversation(
  conversationId: string,
  updates: {
    last_user_message?: string | null
    last_ai_message?: string | null
    conversation_state?: Record<string, any>
    summary?: string | null
    summarycount?: number
    status?: 'active' | 'completed' | 'archived'
  }
): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (error) {
    console.error('Error updating conversation:', error)
    throw error
  }
}

/**
 * Get conversation by ID
 */
export async function getConversation(conversationId: string): Promise<AIConversation | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching conversation:', error)
    throw error
  }

  return data as AIConversation
}


