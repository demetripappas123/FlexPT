'use client'

import React, { useState, useEffect, useRef } from 'react'
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
import { createSession } from '@/supabase/upserts/createsession'
import { useRouter } from 'next/navigation'
import { fetchClients, Client } from '@/supabase/fetches/fetchpeople'
import { fetchProspects, Prospect } from '@/supabase/fetches/fetchpeople'
import { SessionType } from '@/supabase/fetches/fetchsessions'
import { upsertProspect, ProspectFormData } from '@/supabase/upserts/upsertperson'
import { fetchPackages } from '@/supabase/fetches/fetchpackages'
import { fetchPersonPackagesWithRemaining, PersonPackageWithRemaining } from '@/supabase/fetches/fetchpersonpackageswithremaining'
import { useAuth } from '@/context/authcontext'

type AddEventDialogProps = {
  initialPersonId?: string | null
  initialType?: SessionType
  trigger?: React.ReactNode
}

export default function AddEventDialog({ initialPersonId = null, initialType = 'Client Session', trigger }: AddEventDialogProps = {}) {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<SessionType>(initialType)
  const [personId, setPersonId] = useState<string | null>(initialPersonId)
  // Generate time slots in 15-minute intervals (12-hour format with AM/PM)
  type TimeSlot = {
    display: string // 12-hour format for display (e.g., "2:30 PM")
    value: string // 24-hour format for storage (e.g., "14:30")
  }

  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const ampm = hour < 12 ? 'AM' : 'PM'
        const display = `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`
        const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        slots.push({ display, value })
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Initialize with current date and nearest 15-minute time
  const getInitialDate = (): string => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  const getInitialTime = (): string => {
    const now = new Date()
    const minutes = Math.round(now.getMinutes() / 15) * 15
    return `${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const [startDate, setStartDate] = useState<string>(getInitialDate())
  const [startTime, setStartTime] = useState<string>(getInitialTime())
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState<boolean>(false)
  const timeDropdownRef = useRef<HTMLDivElement>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [addProspectOpen, setAddProspectOpen] = useState(false)
  const [prospectName, setProspectName] = useState('')
  const [prospectNumber, setProspectNumber] = useState('')
  const [prospectNotes, setProspectNotes] = useState('')
  const [prospectLeadSource, setProspectLeadSource] = useState('')
  const [addingProspect, setAddingProspect] = useState(false)
  const [selectedPersonPackageId, setSelectedPersonPackageId] = useState<string | null>(null)
  const [availablePersonPackages, setAvailablePersonPackages] = useState<PersonPackageWithRemaining[]>([])
  const [packages, setPackages] = useState<any[]>([])

  // Determine if we should show clients or prospects
  // Only "Client Session" uses clients, all other types use prospects
  const isClientType = type === 'Client Session'
  const isProspectType = type !== 'Client Session'

  // Update personId when initialPersonId changes
  useEffect(() => {
    if (initialPersonId !== null && initialPersonId !== undefined) {
      setPersonId(initialPersonId)
      setType(initialType)
    }
  }, [initialPersonId, initialType])

  // Load clients, prospects, and packages
  useEffect(() => {
    const loadPeople = async () => {
      if (!user?.id) return
      // Batch fetch all data in parallel
      const [clientsData, prospectsData, packagesData] = await Promise.all([
        fetchClients(user.id),
        fetchProspects(user.id),
        fetchPackages(),
      ])
      setClients(clientsData)
      setProspects(prospectsData)
      setPackages(packagesData)
    }
    loadPeople()
  }, [user])

  // Handle click outside time dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false)
      }
    }

    if (isTimeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTimeDropdownOpen])

  // Load available person packages when client is selected and type is Client Session
  // This fetches person_packages for the selected client (personId) that are:
  // - Active status
  // - Have remaining sessions (used_units < total_units)
  useEffect(() => {
    const loadPersonPackages = async () => {
      const isClientSession = type === 'Client Session'
      if (isClientSession && personId) {
        try {
          // Fetch person_packages for the selected client ID, filtered to active with remaining sessions
          const personPackages = await fetchPersonPackagesWithRemaining(personId)
          setAvailablePersonPackages(personPackages)
          // Reset selection if current selection is no longer available
          if (selectedPersonPackageId && !personPackages.find(pp => pp.id === selectedPersonPackageId)) {
            setSelectedPersonPackageId(null)
          }
        } catch (err) {
          console.error('Error loading person packages:', err)
          setAvailablePersonPackages([])
        }
      } else {
        setAvailablePersonPackages([])
        setSelectedPersonPackageId(null)
      }
    }
    loadPersonPackages()
  }, [personId, type, selectedPersonPackageId])

  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prospectName.trim()) {
      alert('Please enter a prospect name')
      return
    }
    if (!prospectLeadSource.trim()) {
      alert('Please enter a lead source')
      return
    }

    setAddingProspect(true)
    // Use lead_source as-is (must match ENUM values exactly)
    const prospectData: ProspectFormData = {
      name: prospectName,
      number: prospectNumber || undefined,
      notes: prospectNotes || undefined,
      lead_source: prospectLeadSource || null,
    }

    try {
      const result = await upsertProspect(prospectData, user?.id || null)
      // Refresh prospects list
      const prospectsData = await fetchProspects(user?.id || null)
      setProspects(prospectsData)
      // Select the newly created prospect
      if (result && result[0]) {
        setPersonId(result[0].id)
      }
      // Reset form and close dialog
      setProspectName('')
      setProspectNumber('')
      setProspectNotes('')
      setProspectLeadSource('')
      setAddProspectOpen(false)
    } catch (err) {
      console.error(err)
      alert('Error creating prospect.')
    } finally {
      setAddingProspect(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!personId) {
      alert('Please select a client or prospect')
      return
    }
    
    setLoading(true)

    try {
      // Combine date and time into ISO string
      const dateTimeString = `${startDate}T${startTime}:00`
      const startDateTime = new Date(dateTimeString)
      
      const newSession = await createSession({
        type,
        person_id: personId,
        start_time: startDateTime.toISOString(), // Scheduled time
        trainer_id: user?.id || null,
        person_package_id: selectedPersonPackageId,
        converted: false,
      })
      
      // Navigate to the session page where workout can be assigned
      router.push(`/events/${newSession.id}`)
      
      // Reset form
      setType('Client Session')
      setPersonId(null)
      setSelectedPersonPackageId(null)
      setStartDate(getInitialDate())
      setStartTime(getInitialTime())
      // Close the dialog
      setOpen(false)
    } catch (err) {
      console.error('Error creating session:', err)
      alert('Error creating session. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer">
            Add Event
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
          <DialogDescription>
            Fill out the information to create a new session or event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Type */}
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as SessionType)
              setPersonId(null) // Reset person selection when type changes
              setSelectedPersonPackageId(null) // Reset package selection
            }}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option>Client Session</option>
            <option>Prospect Session</option>
            <option>Intro Session</option>
            <option>Followup Session</option>
          </select>

          {/* Person dropdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={personId ?? ''}
                onChange={(e) => {
                  setPersonId(e.target.value)
                  setSelectedPersonPackageId(null) // Reset package when person changes
                }}
                className="flex-1 px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="">Select {isClientType ? 'Client' : 'Prospect'}</option>
                {isClientType && clients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {isProspectType && prospects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {isProspectType && (
                <Button
                  type="button"
                  onClick={() => setAddProspectOpen(true)}
                  className="bg-muted text-foreground hover:bg-muted/80 cursor-pointer whitespace-nowrap"
                >
                  + Add Prospect
                </Button>
              )}
            </div>
          </div>

          {/* Person Package Selection - only for Client Sessions */}
          {isClientType && personId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Package (Optional)
              </label>
              <select
                value={selectedPersonPackageId ?? ''}
                onChange={(e) => setSelectedPersonPackageId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">No package (manual session)</option>
                {availablePersonPackages.map((pp) => {
                  const pkg = packages.find(p => p.id === pp.package_id)
                  return (
                    <option key={pp.id} value={pp.id}>
                      {pkg?.name || 'Unknown Package'} - {pp.remaining_units} out of {pp.total_units} sessions remaining
                    </option>
                  )
                })}
              </select>
              {availablePersonPackages.length === 0 && personId && (
                <p className="text-xs text-muted-foreground">
                  No active packages with remaining sessions found for this client.
                </p>
              )}
            </div>
          )}

          {/* Date and Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Time
              </label>
              <div className="relative" ref={timeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer text-left flex items-center justify-between"
                >
                  <span>{timeSlots.find(slot => slot.value === startTime)?.display || 'Select time'}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isTimeDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isTimeDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-input border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.value}
                        type="button"
                        onClick={() => {
                          setStartTime(slot.value)
                          setIsTimeDropdownOpen(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-foreground hover:bg-muted focus:bg-muted focus:outline-none ${
                          startTime === slot.value ? 'bg-muted/50' : ''
                        }`}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
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

        {/* Add Prospect Dialog */}
        <Dialog open={addProspectOpen} onOpenChange={setAddProspectOpen}>
          <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border">
            <DialogHeader>
              <DialogTitle>Add New Prospect</DialogTitle>
              <DialogDescription>
                Create a new prospect to assign to this session.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddProspect} className="grid gap-4 py-4">
              <input
                type="text"
                placeholder="Name *"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
              <input
                type="text"
                placeholder="Number"
                value={prospectNumber}
                onChange={(e) => setProspectNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <select
                value={prospectLeadSource}
                onChange={(e) => setProspectLeadSource(e.target.value)}
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
                value={prospectNotes}
                onChange={(e) => setProspectNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-24 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setAddProspectOpen(false)
                    setProspectName('')
                    setProspectNumber('')
                    setProspectNotes('')
                    setProspectLeadSource('')
                  }}
                  className="bg-muted text-foreground hover:bg-muted/80 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:bg-primary/50 cursor-pointer disabled:cursor-not-allowed"
                  disabled={addingProspect}
                >
                  {addingProspect ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
