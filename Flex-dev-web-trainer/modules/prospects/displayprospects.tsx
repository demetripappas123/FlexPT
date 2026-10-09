'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authcontext'
import { fetchProspects, Prospect } from '@/supabase/fetches/fetchpeople'

export default function DisplayProspects() {
  const router = useRouter()
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProspects = async () => {
      if (!user) return
      try {
        const data = await fetchProspects(user.id)
        setProspects(data)
      } catch (err) {
        console.error(err)
        setError('Failed to load prospects.')
      } finally {
        setLoading(false)
      }
    }

    loadProspects()
  }, [user])

  if (loading) return <div className="text-muted-foreground">Loading prospects...</div>
  if (error) return <div className="text-red-400">{error}</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {prospects.map((prospect) => (
        <div
          key={prospect.id}
          onClick={() => router.push(`/people/${prospect.id}`)}
          className="bg-card border border-border rounded-lg shadow p-4 overflow-hidden cursor-pointer hover:bg-muted transition-colors"
        >
          <h2 className="text-lg font-semibold text-foreground truncate">
            {prospect.name}
          </h2>
          <p className="text-muted-foreground truncate">{prospect.number}</p>
          <p
            className="text-muted-foreground truncate"
            title={prospect.notes ?? ''} // show full notes on hover
          >
            {prospect.notes ?? 'No notes'}
          </p>
        </div>
      ))}
    </div>
  )
}
