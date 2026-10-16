'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Task, taskActionLabel } from '@/supabase/fetches/fetchtasks'
import TaskDetailDialog from '@/modules/dashboard/taskdetaildialog'
import AddEventDialog from '@/modules/calendar/addevent'
import AssignProgramWorkout from '@/modules/clients/assignprogramworkout'
import AssignCheckinFormDialog from '@/modules/clients/assigncheckinformdialog'

type TaskFeedProps = {
  tasks: Task[]
  loading?: boolean
  compact?: boolean
  onFulfilled?: () => void
}

export default function TaskFeed({ tasks, loading, compact = false, onFulfilled }: TaskFeedProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Task | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [assignWorkoutOpen, setAssignWorkoutOpen] = useState(false)
  const [assignCheckinOpen, setAssignCheckinOpen] = useState(false)

  const detailOpen =
    Boolean(selected) && !scheduleOpen && !assignWorkoutOpen && !assignCheckinOpen

  const handlePrimaryAction = (task: Task) => {
    if (task.kind === 'session') {
      setScheduleOpen(true)
      return
    }
    if (task.kind === 'workout') {
      setAssignWorkoutOpen(true)
      return
    }
    if (task.kind === 'checkin' || task.kind === 'habit') {
      setAssignCheckinOpen(true)
      return
    }
    if (task.kind === 'meal') {
      router.push(`/people/${task.person_id}?tab=nutrition`)
      return
    }
    router.push(`/people/${task.person_id}`)
  }

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
    <>
      <div className="space-y-2">
        {shown.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setSelected(task)}
            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors group text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-foreground">
                {(task.person_name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                {taskActionLabel(task.kind)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {task.person_name || 'Client'}
                {task.service_name ? ` · ${task.service_name}` : ''}
                {task.due_date ? ` · due ${new Date(task.due_date).toLocaleDateString()}` : ''}
              </p>
            </div>
          </button>
        ))}
      </div>

      <TaskDetailDialog
        task={selected}
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onPrimaryAction={handlePrimaryAction}
      />

      {selected?.kind === 'session' && (
        <AddEventDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          initialPersonId={selected.person_id}
          initialType="Client Session"
          initialPersonPackageId={selected.person_package_id}
        />
      )}

      {selected?.kind === 'workout' && (
        <AssignProgramWorkout
          open={assignWorkoutOpen}
          onOpenChange={setAssignWorkoutOpen}
          personId={selected.person_id}
          onWorkoutAssigned={() => {
            setAssignWorkoutOpen(false)
            setSelected(null)
            onFulfilled?.()
          }}
        />
      )}

      {(selected?.kind === 'checkin' || selected?.kind === 'habit') && (
        <AssignCheckinFormDialog
          open={assignCheckinOpen}
          onOpenChange={setAssignCheckinOpen}
          personId={selected.person_id}
          onAssigned={() => {
            setAssignCheckinOpen(false)
            setSelected(null)
            onFulfilled?.()
          }}
        />
      )}
    </>
  )
}
