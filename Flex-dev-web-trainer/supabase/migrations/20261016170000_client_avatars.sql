-- Client photo icons. Files live in the public client-avatars bucket.
-- Path shape: {person_id}/avatar-{timestamp}.{ext}
--
-- If you are not using `supabase db push`, paste this whole file into the
-- Supabase SQL Editor and run it.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS avatar_path text;

COMMENT ON COLUMN public.people.avatar_path IS
  'Storage path in the client-avatars bucket. Null until a photo is uploaded.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-avatars',
  'client-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- `name` must stay outside the people subquery. Inside it, Postgres binds
-- `name` to people.name and the ownership check never matches.

DROP POLICY IF EXISTS client_avatars_public_read ON storage.objects;
CREATE POLICY client_avatars_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'client-avatars');

DROP POLICY IF EXISTS client_avatars_trainer_insert ON storage.objects;
CREATE POLICY client_avatars_trainer_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.people p
      WHERE p.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_avatars_trainer_update ON storage.objects;
CREATE POLICY client_avatars_trainer_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.people p
      WHERE p.trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'client-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.people p
      WHERE p.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS client_avatars_trainer_delete ON storage.objects;
CREATE POLICY client_avatars_trainer_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.people p
      WHERE p.trainer_id = auth.uid()
    )
  );
