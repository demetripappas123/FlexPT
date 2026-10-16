'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, ClipboardList, Dumbbell, MessageSquare, User, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Task,
  taskActionLabel,
  taskDescription,
  taskKindLabel,
} from '@/supabase/fetches/fetchtasks'
import { useAuth } from '@/context/authcontext'
import { fetchPersonSessionsBehind } from '@/supabase/utils/sessionsBehind'

type TaskDetailDialogProps = {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrimaryAction: (task: Task) => void
}

export default function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onPrimaryAction,
}: TaskDetailDialogProps) {
  const { user } = useAuth()
  const [sessionsBehind, setSessionsBehind] = useState<number | null>(null)
  const [loadingBehind, setLoadingBehind] = useState(false)

  useEffect(() => {
    if (!open || !task || task.kind !== 'session') {
      setSessionsBehind(null)
      return
    }
    let cancelled = false
    setLoadingBehind(true)
    fetchPersonSessionsBehind(task.person_id, user?.id)
      .then((count) => {
        if (!cancelled) setSessionsBehind(count)
      })
      .catch((err) => {
        console.error('Error loading sessions behind:', err)
        if (!cancelled) setSessionsBehind(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingBehind(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, task, user?.id])

  if (!task) return null

  const due = task.due_date
    ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{taskActionLabel(task.kind)}</DialogTitle>
          <DialogDescription>{taskDescription(task.kind)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary">
                {(task.person_name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {task.person_name || 'Client'}
              </p>
              <p className="text-xs text-muted-foreground">
                {taskKindLabel(task.kind)}
                {task.service_name ? ` · ${task.service_name}` : ''}
              </p>
            </div>
          </div>

          {task.kind === 'session' && (
            <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              {loadingBehind ? (
                <span className="text-muted-foreground">Checking session pace…</span>
              ) : sessionsBehind != null && sessionsBehind > 0 ? (
                <span className="font-medium text-destructive">
                  {sessionsBehind} session{sessionsBehind === 1 ? '' : 's'} behind
                </span>
              ) : (
                <span className="text-muted-foreground">Not behind on sessions</span>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Due</dt>
              <dd className="text-foreground">{due ?? 'No due date'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Opened</dt>
              <dd className="text-foreground">
                {new Date(task.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onPrimaryAction(task)}
            >
              {task.kind === 'session' ? (
                <Calendar className="h-4 w-4 mr-2" />
              ) : task.kind === 'workout' ? (
                <Dumbbell className="h-4 w-4 mr-2" />
              ) : task.kind === 'meal' ? (
                <Utensils className="h-4 w-4 mr-2" />
              ) : (
                <ClipboardList className="h-4 w-4 mr-2" />
              )}
              {taskActionLabel(task.kind)}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="cursor-pointer" asChild>
                <Link href={`/people/${task.person_id}`}>
                  <User className="h-4 w-4 mr-2" />
                  Open client
                </Link>
              </Button>
              <Button variant="outline" className="cursor-pointer" asChild>
                <Link href={`/chat/${task.person_id}`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
