import { supabaseAdmin } from '../supabaseAdmin'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/

type HttpError = Error & { status: number }

function httpError(message: string, status: number): HttpError {
  return Object.assign(new Error(message), { status })
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeUsername(username?: string | null): string | null {
  const trimmed = username?.trim()
  return trimmed ? trimmed : null
}

export async function requireTrainerFromToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data.user) {
    throw httpError('Unauthorized', 401)
  }
  if (data.user.app_metadata?.role === 'client') {
    throw httpError('Client accounts cannot manage logins', 403)
  }

  const { data: trainer, error: trainerError } = await supabaseAdmin
    .from('trainers')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (trainerError || !trainer) {
    throw httpError('Not a trainer', 403)
  }

  return data.user
}

export async function upsertPersonAuth(opts: {
  personId: string
  trainerId: string
  email: string
  password?: string
  username?: string | null
}) {
  const email = normalizeEmail(opts.email)
  const username = normalizeUsername(opts.username ?? null)

  if (!email || !email.includes('@')) {
    throw httpError('A valid email is required', 400)
  }
  if (username && !USERNAME_RE.test(username)) {
    throw httpError('Username must be 3–32 letters, numbers, or underscores', 400)
  }

  const { data: person, error: personError } = await supabaseAdmin
    .from('people')
    .select('id, trainer_id, auth_user_id, email, username')
    .eq('id', opts.personId)
    .single()

  if (personError || !person) {
    throw httpError('Person not found', 404)
  }
  if (person.trainer_id && person.trainer_id !== opts.trainerId) {
    throw httpError('This person belongs to another trainer', 403)
  }

  let authUserId = (person.auth_user_id as string | null) ?? null

  if (!authUserId) {
    if (!opts.password || opts.password.length < 6) {
      throw httpError('Password must be at least 6 characters to create a login', 400)
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      user_metadata: {
        username,
        person_id: person.id,
      },
      app_metadata: {
        role: 'client',
      },
    })

    if (createError || !created.user) {
      throw httpError(createError?.message || 'Failed to create auth user', 400)
    }
    authUserId = created.user.id
  } else {
    const update: {
      email: string
      password?: string
      user_metadata: { username: string | null; person_id: string }
      app_metadata: { role: 'client' }
    } = {
      email,
      user_metadata: { username, person_id: person.id },
      app_metadata: { role: 'client' },
    }

    if (opts.password) {
      if (opts.password.length < 6) {
        throw httpError('Password must be at least 6 characters', 400)
      }
      update.password = opts.password
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, update)
    if (updateError) {
      throw httpError(updateError.message, 400)
    }
  }

  const { data: updated, error: linkError } = await supabaseAdmin
    .from('people')
    .update({
      email,
      username,
      auth_user_id: authUserId,
    })
    .eq('id', person.id)
    .select()
    .single()

  if (linkError) {
    if (!person.auth_user_id && authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }
    throw httpError(linkError.message, 400)
  }

  return updated
}
