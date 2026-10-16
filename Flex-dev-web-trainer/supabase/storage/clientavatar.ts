import { supabase } from '../supabaseClient'
import { Person } from '../fetches/fetchpeople'

export const CLIENT_AVATAR_BUCKET = 'client-avatars'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export function clientAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const { data } = supabase.storage.from(CLIENT_AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

export async function uploadClientAvatar(personId: string, file: File, previousPath?: string | null): Promise<Person> {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Use a JPEG, PNG, WebP, or GIF.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Photo must be 5 MB or smaller.')
  }

  const path = `${personId}/avatar-${Date.now()}.${extensionFor(file)}`
  const { error: uploadError } = await supabase.storage.from(CLIENT_AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('people')
    .update({ avatar_path: path })
    .eq('id', personId)
    .select('*')
    .single()

  if (error) throw error

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(CLIENT_AVATAR_BUCKET).remove([previousPath])
  }

  return data as Person
}

export async function removeClientAvatar(personId: string, previousPath?: string | null): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .update({ avatar_path: null })
    .eq('id', personId)
    .select('*')
    .single()

  if (error) throw error
  if (previousPath) {
    await supabase.storage.from(CLIENT_AVATAR_BUCKET).remove([previousPath])
  }
  return data as Person
}
