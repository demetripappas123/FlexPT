-- Client/prospect login linkage.
-- Password is NOT stored here. Supabase Auth (auth.users) owns credentials.
--
-- If you are not using `supabase db push`, paste this whole file into the
-- Supabase SQL Editor and run it.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Empty strings from forms should not count as values.
UPDATE public.people
SET email = NULLIF(btrim(email), ''),
    username = NULLIF(btrim(username), '')
WHERE email IS NOT NULL OR username IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'people_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.people
      ADD CONSTRAINT people_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS people_auth_user_id_key
  ON public.people (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_email_lower_key
  ON public.people (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_username_lower_key
  ON public.people (lower(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.people.email IS
  'Login/contact email. Source of truth for credentials is auth.users.';
COMMENT ON COLUMN public.people.username IS
  'Optional handle. Login still uses email.';
COMMENT ON COLUMN public.people.auth_user_id IS
  'Linked Supabase Auth user. Null until a client login is created.';
