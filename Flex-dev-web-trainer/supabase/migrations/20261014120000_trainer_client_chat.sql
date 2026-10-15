-- Trainer ↔ client chat.
-- Durable history lives in Postgres (one thread per trainer+person).
-- Live delivery uses Realtime postgres_changes on chat_messages.
-- A trainer can message every client they own. A client can only message their trainer.

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, person_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('trainer', 'client')),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_conversations_trainer_last_idx
  ON public.chat_conversations (trainer_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS chat_conversations_person_idx
  ON public.chat_conversations (person_id);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_created_idx
  ON public.chat_messages (conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_chat_conversation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(btrim(NEW.body), 140)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_conversation ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_chat_conversation();

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conversations_select ON public.chat_conversations;
CREATE POLICY chat_conversations_select ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (
    trainer_id = auth.uid()
    OR person_id IN (
      SELECT id FROM public.people WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_conversations_update ON public.chat_conversations;
CREATE POLICY chat_conversations_update ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (
    trainer_id = auth.uid()
    OR person_id IN (
      SELECT id FROM public.people WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    trainer_id = auth.uid()
    OR person_id IN (
      SELECT id FROM public.people WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_conversations_insert ON public.chat_conversations;
CREATE POLICY chat_conversations_insert ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      trainer_id = auth.uid()
      AND person_id IN (
        SELECT id FROM public.people
        WHERE trainer_id = auth.uid()
          AND converted_at IS NOT NULL
      )
    )
    OR (
      person_id IN (
        SELECT id FROM public.people
        WHERE auth_user_id = auth.uid()
          AND trainer_id IS NOT NULL
          AND converted_at IS NOT NULL
      )
      AND trainer_id IN (
        SELECT trainer_id FROM public.people
        WHERE auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.chat_conversations)
  );

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND conversation_id IN (SELECT id FROM public.chat_conversations)
    AND (
      (
        sender_role = 'trainer'
        AND EXISTS (
          SELECT 1 FROM public.chat_conversations c
          WHERE c.id = conversation_id AND c.trainer_id = auth.uid()
        )
      )
      OR (
        sender_role = 'client'
        AND EXISTS (
          SELECT 1 FROM public.chat_conversations c
          JOIN public.people p ON p.id = c.person_id
          WHERE c.id = conversation_id AND p.auth_user_id = auth.uid()
        )
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.chat_conversations IS
  'One thread per trainer + client. Clients cannot message other clients.';
COMMENT ON TABLE public.chat_messages IS
  'Durable chat history. Realtime publishes inserts for live UI.';
