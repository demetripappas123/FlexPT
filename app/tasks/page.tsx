'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { fetchOpenTasks, Task } from '@/supabase/fetches/fetchtasks'
import TaskFeed from '@/modules/dashboard/taskfeed'
import Link from 'next/link'

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        const data = await fetchOpenTasks(user.id, 100)
        setTasks(data)
      } catch (err) {
        console.error('Error loading tasks:', err)
        setTasks([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id])

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Open deliverables from paid entitlements. Scheduling or assigning closes them.
          </p>
        </div>
        <Link href="/dash" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
      </div>
      <div className="bg-card border border-border rounded-lg p-4 max-w-2xl">
        <TaskFeed tasks={tasks} loading={loading} />
      </div>
    </div>
  )
}
