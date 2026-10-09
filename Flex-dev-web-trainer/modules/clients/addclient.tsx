'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { upsertClient, ClientFormData } from '@/supabase/upserts/upsertperson'
import { upsertPersonLogin } from '@/supabase/auth/person-login'
import { useAuth } from '@/context/authcontext'

interface AddClientDialogProps {
  onClientAdded?: () => void
}

export default function AddClientDialog({ onClientAdded }: AddClientDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setName('')
    setNumber('')
    setNotes('')
    setEmail('')
    setUsername('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const trimmedEmail = email.trim()
    const trimmedUsername = username.trim()
    if (password && !trimmedEmail) {
      alert('Email is required to create a client login.')
      setLoading(false)
      return
    }
    if (trimmedEmail && password && password.length < 6) {
      alert('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const clientData: ClientFormData = {
      name,
      number,
      notes,
      email: trimmedEmail || null,
      username: trimmedUsername || null,
    }

    try {
      const saved = await upsertClient(clientData, user?.id || null)
      const personId = saved?.[0]?.id as string | undefined
      if (personId && trimmedEmail && password) {
        await upsertPersonLogin(personId, {
          email: trimmedEmail,
          password,
          username: trimmedUsername || null,
        })
      }
      resetForm()
      setOpen(false)
      router.refresh()
      onClientAdded?.()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Error saving client.')
    } finally {
      setLoading(false)
    }
  }

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer">
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Fill out the information to create a new client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <input
            type="text"
            placeholder="Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-24 resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Optional login. Password is saved in Auth, not on the person row. Leave password blank to add contact email only.
          </p>
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <input
            type="text"
            placeholder="Username (optional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <input
            type="password"
            placeholder="Password (optional, creates login)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button className="bg-muted text-foreground hover:bg-muted/80 cursor-pointer">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:bg-primary/50 cursor-pointer disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
