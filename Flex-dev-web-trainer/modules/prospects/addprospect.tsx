'use client'

import React, { useState } from 'react'
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
import { upsertProspect, ProspectFormData } from '@/supabase/upserts/upsertperson'
import { useAuth } from '@/context/authcontext'

export default function AddProspectDialog() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Use lead_source as-is (must match ENUM values exactly)
    const prospectData: ProspectFormData = { 
      name, 
      number, 
      notes, 
      lead_source: leadSource || null
    }

    try {
      await upsertProspect(prospectData, user?.id || null)
      setName('')
      setNumber('')
      setNotes('')
      setLeadSource('')
      alert('Prospect saved!')
      // Reload the page to show the new prospect
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Error saving prospect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer">
          Add Prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border">
        <DialogHeader>
          <DialogTitle>Add New Prospect</DialogTitle>
          <DialogDescription>
            Fill out the information to create a new prospect.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            required
          />
          <input
            type="text"
            placeholder="Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <select
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            required
          >
            <option value="">Select Lead Source *</option>
            <option value="instagram reel">Instagram Reel</option>
            <option value="instagram dms">Instagram DMs</option>
            <option value="tiktok post">TikTok Post</option>
            <option value="tiktok dms">TikTok DMs</option>
            <option value="facebook link">Facebook Link</option>
            <option value="snapchat link">Snapchat Link</option>
            <option value="email campaign">Email Campaign</option>
            <option value="text campaign">Text Campaign</option>
            <option value="call campaign">Call Campaign</option>
            <option value="website">Website</option>
            <option value="personal link">Personal Link</option>
            <option value="in person">In Person</option>
            <option value="client referral">Client Referral</option>
          </select>
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-24 resize-none"
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
