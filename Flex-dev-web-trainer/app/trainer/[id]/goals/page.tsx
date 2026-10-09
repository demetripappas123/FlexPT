'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import TrainerGoals from '@/modules/trainer/trainergoals'

export default function TrainerGoalsPage() {
  const params = useParams()
  const router = useRouter()
  const [trainerId, setTrainerId] = useState<string | null>(null)
  const [trainerGoal, setTrainerGoal] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = params.id as string
    if (!id) {
      setLoading(false)
      return
    }

    setTrainerId(id)
    
    // Fetch trainer goal record
    const loadTrainerGoal = async () => {
      try {
        const { data: goalData, error: goalError } = await supabase
          .from('trainer_goals')
          .select('id')
          .eq('id', id)
          .single()

        if (goalError) {
          console.error('Error loading trainer goals:', goalError)
          setTrainerGoal(null)
        } else if (goalData) {
          setTrainerGoal({ id: goalData.id })
        } else {
          setTrainerGoal(null)
        }
      } catch (err) {
        console.error('Error loading trainer goals:', err)
        setTrainerGoal(null)
      } finally {
        setLoading(false)
      }
    }

    loadTrainerGoal()
  }, [params.id])

  if (loading) return <p className="text-gray-300">Loading...</p>
  if (!trainerId || !trainerGoal) return <p className="text-gray-300">Trainer goals not found.</p>

  return (
    <div className="p-6 space-y-4 bg-[#111111] min-h-screen text-white">
      <button
        onClick={() => router.back()}
        className="px-3 py-1 bg-[#333333] rounded-md hover:bg-[#404040] cursor-pointer"
      >
        ← Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Business Goals</h1>
      </div>

      <div className="p-4 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md">
        <TrainerGoals trainerId={trainerId} />
      </div>
    </div>
  )
}

