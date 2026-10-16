'use client'

import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Person } from '@/supabase/fetches/fetchpeople'
import { clientAvatarUrl, removeClientAvatar, uploadClientAvatar } from '@/supabase/storage/clientavatar'

type ClientAvatarProps = {
  person: Person
  onUpdated: (person: Person) => void
  size?: number
}

export default function ClientAvatar({ person, onUpdated, size = 56 }: ClientAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = clientAvatarUrl(person.avatar_path)
  const initial = (person.name || '?').trim().charAt(0).toUpperCase() || '?'

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onUpdated(await uploadClientAvatar(person.id, file, person.avatar_path))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onRemove = async () => {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await removeClientAvatar(person.id, person.avatar_path))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not remove photo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative overflow-hidden rounded-full border border-border bg-secondary text-foreground disabled:opacity-60"
        style={{ width: size, height: size }}
        title={url ? 'Change photo' : 'Add photo'}
        aria-label={url ? 'Change photo' : 'Add photo'}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-medium">{initial}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 text-background opacity-0 transition-opacity hover:bg-foreground/45 hover:opacity-100">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      {url && !busy && (
        <button
          type="button"
          onClick={() => void onRemove()}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label="Remove photo"
          title="Remove photo"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {error && <p className="absolute left-0 top-full mt-1 w-48 text-xs text-destructive">{error}</p>}
    </div>
  )
}
