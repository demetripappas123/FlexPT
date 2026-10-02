'use client'

import Link from 'next/link'
import { Task, taskActionLabel } from '@/supabase/fetches/fetchtasks'

type TaskFeedProps = {
  tasks: Task[]
  loading?: boolean
  compact?: boolean
}

export default function TaskFeed({ tasks, loading, compact = false }: TaskFeedProps) {
  if (loading) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Loading...</div>
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {compact
          ? 'No open deliverables'
          : 'No open deliverables. Paid entitlements with remaining units show up here.'}
      </div>
    )
  }

  const shown = compact ? tasks.slice(0, 7) : tasks

  return (
    <div className="space-y-2">
      {shown.map((task) => (
        <Link
          key={task.id}
          href={`/people/${task.person_id}`}
          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary">
              {(task.person_name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {task.person_name || 'Client'} — {taskActionLabel(task.kind)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {task.service_name || task.kind}
              {task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString()}` : ''}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
