'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authcontext'
import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { Program } from '@/supabase/upserts/upsertprogram'
import DeleteProgramDialog from './deleteprogram'
import { TrashIcon } from '@heroicons/react/24/solid'

export default function ShowPrograms() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshPrograms = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchPrograms(user.id)
      setPrograms(data)
    } catch (err) {
      console.error('Failed to fetch programs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshPrograms()
  }, [user])

  if (loading) return <p className="text-muted-foreground">Loading programs...</p>
  if (programs.length === 0) return <p className="text-muted-foreground">No programs found.</p>

  return (
    <div className="space-y-4">
      {programs.map((program) => (
        <div
          key={program.id}
          className="flex items-center justify-between bg-card border border-border rounded-md shadow hover:bg-muted transition-colors"
        >
          {/* Entire left side clickable */}
          <div
            className="flex-1 p-4 cursor-pointer"
            onClick={() => router.push(`/programs/${program.id}`)}
          >
            <h3 className="text-lg font-semibold text-foreground">{program.name}</h3>
          </div>

          {/* Trash icon trigger */}
          <DeleteProgramDialog
            programId={program.id!.toString()}
            programName={program.name}
            onDeleted={refreshPrograms}
          >
            <TrashIcon
              className="w-6 h-6 mx-4 text-red-500 hover:text-red-600 cursor-pointer"
            />
          </DeleteProgramDialog>
        </div>
      ))}
    </div>
  )
}
