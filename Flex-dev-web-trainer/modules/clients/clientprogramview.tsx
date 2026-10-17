'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Check } from 'lucide-react'
import { WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { AssignedMeal } from '@/supabase/fetches/fetchassignedmeals'
import { CheckinFormAssignment } from '@/supabase/fetches/fetchcheckinformassignments'
import { CHECKIN_FORM_PURPOSE_LABEL } from '@/supabase/fetches/fetchcheckinforms'
import {
  ProgramAssignment,
  ProgramAssignmentStatus,
  ProgramGoal,
  ProgramGoalKind,
  PROGRAM_ASSIGNMENT_STATUS_LABEL,
  PROGRAM_GOAL_KIND_LABEL,
  fetchProgramGoals,
} from '@/supabase/fetches/fetchprogramassignments'
import {
  deleteProgramGoal,
  updateProgramAssignmentStatus,
  upsertProgramGoal,
} from '@/supabase/upserts/upsertprogramassignment'
import {
  formatAssignedLine,
  formatLoggedSetLine,
  formatAssignedMealFood,
  formatEatenMealFood,
} from '@/supabase/utils/formatWorkload'
import { workoutDeliveryCardClass } from '@/supabase/utils/workoutDelivery'
import {
  ScheduleSessionButton,
  WorkoutDeliveryBadge,
} from '@/modules/clients/workoutsessioncontrols'

type InnerTab = 'workouts' | 'meals' | 'checkins' | 'goals'

type ClientProgramViewProps = {
  personId: string
  assignments: ProgramAssignment[]
  workouts: WorkoutWithData[]
  meals: AssignedMeal[]
  checkins: CheckinFormAssignment[]
  loading?: boolean
  onAssignClick: () => void
  onReload: () => void
  onWorkoutClick: (workout: WorkoutWithData) => void
  onFillCheckin: (assignment: CheckinFormAssignment) => void
  sessionUnitsRemaining?: number
  onScheduleSession?: (workout: WorkoutWithData) => void
}

function dateKey(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDay(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ClientProgramView({
  personId,
  assignments,
  workouts,
  meals,
  checkins,
  loading,
  onAssignClick,
  onReload,
  onWorkoutClick,
  onFillCheckin,
  sessionUnitsRemaining = 0,
  onScheduleSession,
}: ClientProgramViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(assignments[0]?.id ?? null)
  const [innerTab, setInnerTab] = useState<InnerTab>('workouts')
  const [goals, setGoals] = useState<ProgramGoal[]>([])
  const [goalLabel, setGoalLabel] = useState('')
  const [goalKind, setGoalKind] = useState<ProgramGoalKind>('qualitative')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalUnit, setGoalUnit] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    if (!selectedId && assignments[0]?.id) setSelectedId(assignments[0].id)
    if (selectedId && !assignments.some((a) => a.id === selectedId)) {
      setSelectedId(assignments[0]?.id ?? null)
    }
  }, [assignments, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setGoals([])
      return
    }
    let cancelled = false
    fetchProgramGoals(selectedId)
      .then((rows) => {
        if (!cancelled) setGoals(rows)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selected = assignments.find((a) => a.id === selectedId) ?? null

  const assignmentWorkouts = useMemo(
    () =>
      workouts
        .filter((w) => w.assignment_id === selectedId)
        .sort((a, b) => dateKey(a.workout_date).localeCompare(dateKey(b.workout_date))),
    [workouts, selectedId]
  )
  const assignmentMeals = useMemo(
    () =>
      meals
        .filter((m) => m.program_assignment_id === selectedId)
        .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date)),
    [meals, selectedId]
  )
  const assignmentCheckins = useMemo(
    () =>
      checkins
        .filter((c) => c.program_assignment_id === selectedId)
        .sort((a, b) => a.assigned_date.localeCompare(b.assigned_date)),
    [checkins, selectedId]
  )

  const weekGroups = useMemo(() => {
    const map = new Map<number, WorkoutWithData[]>()
    for (const workout of assignmentWorkouts) {
      const week = workout.week_number && workout.week_number > 0 ? workout.week_number : 1
      const list = map.get(week) ?? []
      list.push(workout)
      map.set(week, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [assignmentWorkouts])

  const handleStatus = async (status: ProgramAssignmentStatus) => {
    if (!selected) return
    setStatusBusy(true)
    try {
      await updateProgramAssignmentStatus(selected.id, status)
      onReload()
    } finally {
      setStatusBusy(false)
    }
  }

  const handleAddGoal = async () => {
    if (!selected || !goalLabel.trim()) return
    setSavingGoal(true)
    try {
      const created = await upsertProgramGoal({
        assignment_id: selected.id,
        person_id: personId,
        kind: goalKind,
        label: goalLabel.trim(),
        target_value: goalTarget ? Number(goalTarget) : null,
        unit: goalUnit.trim() || null,
      })
      setGoals((prev) => [...prev, created])
      setGoalLabel('')
      setGoalTarget('')
      setGoalUnit('')
    } finally {
      setSavingGoal(false)
    }
  }

  const tabs: { id: InnerTab; label: string; count: number }[] = [
    { id: 'workouts', label: 'Workouts', count: assignmentWorkouts.length },
    { id: 'meals', label: 'Meals', count: assignmentMeals.length },
    { id: 'checkins', label: 'Check-ins', count: assignmentCheckins.length },
    { id: 'goals', label: 'Goals', count: goals.length },
  ]

  return (
    <div className="p-4 bg-card border border-border rounded-md space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Program</h2>
        <Button
          onClick={onAssignClick}
          className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Assign program
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading programs...</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No mesocycle assigned yet. Assign a training and/or nutrition program to stamp weeks onto this client.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                onClick={() => setSelectedId(assignment.id)}
                className={`px-3 py-1.5 rounded-md text-sm border cursor-pointer ${
                  selectedId === assignment.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {assignment.name}
                <span className="ml-2 opacity-70">{PROGRAM_ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Starts {formatDay(selected.start_date)}</span>
                <select
                  value={selected.status}
                  disabled={statusBusy}
                  onChange={(e) => handleStatus(e.target.value as ProgramAssignmentStatus)}
                  className="bg-background text-foreground border border-border rounded-md px-2 py-1 cursor-pointer"
                >
                  {(Object.keys(PROGRAM_ASSIGNMENT_STATUS_LABEL) as ProgramAssignmentStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {PROGRAM_ASSIGNMENT_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 bg-background border border-border rounded-md p-1 w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setInnerTab(tab.id)}
                    className={`px-3 py-1 rounded text-sm cursor-pointer ${
                      innerTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {innerTab === 'workouts' && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Session asks for a time. Solo stays on the assigned day. {sessionUnitsRemaining} session unit
                    {sessionUnitsRemaining === 1 ? '' : 's'} remaining.
                  </p>
                  {weekGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workouts in this block.</p>
                  ) : (
                    weekGroups.map(([week, rows]) => (
                      <div key={week} className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">Week {week}</h3>
                        {rows.map((workout) => (
                          <div
                            key={workout.id}
                            className={`w-full text-left border rounded-md p-3 ${workoutDeliveryCardClass(workout)}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onWorkoutClick(workout)}
                                className="text-left cursor-pointer"
                              >
                                <p className="text-sm font-medium text-foreground">
                                  {workout.day_name || 'Workout'} · {formatDay(dateKey(workout.workout_date))}
                                </p>
                              </button>
                              <div className="flex flex-wrap items-center gap-2">
                                <WorkoutDeliveryBadge workout={workout} />
                                {workout.completed ? (
                                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Done
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Assigned</span>
                                )}
                                {onScheduleSession && (
                                  <ScheduleSessionButton
                                    workout={workout}
                                    remainingUnits={sessionUnitsRemaining}
                                    onSchedule={onScheduleSession}
                                  />
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onWorkoutClick(workout)}
                              className="mt-2 space-y-2 w-full text-left cursor-pointer"
                            >
                              {(workout.exercises ?? []).map((exercise) => {
                                const assigned = formatAssignedLine(exercise)
                                const logged = (exercise.sets ?? [])
                                  .map((set) => formatLoggedSetLine(set))
                                  .filter((line): line is string => Boolean(line))
                                return (
                                  <div key={exercise.id} className="text-xs">
                                    <p className="font-medium text-foreground">{exercise.exercise_name}</p>
                                    <p className="text-muted-foreground">
                                      Assigned: {assigned ?? '—'}
                                    </p>
                                    <p className="text-muted-foreground">
                                      Completed:{' '}
                                      {logged.length > 0 ? logged.join(' · ') : '—'}
                                    </p>
                                  </div>
                                )
                              })}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {innerTab === 'meals' && (
                <div className="space-y-2">
                  {assignmentMeals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No meals in this block.</p>
                  ) : (
                    assignmentMeals.map((meal) => (
                      <div key={meal.id} className="border border-border rounded-md p-3 bg-background">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {meal.meal_name || meal.name} · {formatDay(meal.assigned_date)}
                          </p>
                          <span className="text-xs text-muted-foreground capitalize">{meal.status}</span>
                        </div>
                        {(meal.foods ?? []).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {(meal.foods ?? []).map((food) => (
                              <div key={food.id} className="text-xs text-muted-foreground">
                                <p>Assigned: {formatAssignedMealFood(food) ?? '—'}</p>
                                <p>Eaten: {formatEatenMealFood(food) ?? '—'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {innerTab === 'checkins' && (
                <div className="space-y-2">
                  {assignmentCheckins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No check-ins in this block.</p>
                  ) : (
                    assignmentCheckins.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => onFillCheckin(row)}
                        className="w-full text-left border border-border rounded-md p-3 bg-background hover:bg-muted cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {row.name} · {CHECKIN_FORM_PURPOSE_LABEL[row.purpose ?? 'checkin']}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDay(row.assigned_date)} · {row.status}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {innerTab === 'goals' && (
                <div className="space-y-3">
                  {goals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No goals on this block yet.</p>
                  ) : (
                    goals.map((goal) => (
                      <div key={goal.id} className="border border-border rounded-md p-3 bg-background flex justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{goal.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {PROGRAM_GOAL_KIND_LABEL[goal.kind]}
                            {goal.baseline_value != null ? ` · baseline ${goal.baseline_value}` : ''}
                            {goal.target_value != null ? ` · target ${goal.target_value}` : ''}
                            {goal.unit ? ` ${goal.unit}` : ''}
                            {goal.current_value != null ? ` · now ${goal.current_value}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={async () => {
                            await deleteProgramGoal(goal.id)
                            setGoals((prev) => prev.filter((g) => g.id !== goal.id))
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <select
                      value={goalKind}
                      onChange={(e) => setGoalKind(e.target.value as ProgramGoalKind)}
                      className="col-span-3 bg-background text-foreground border border-border rounded-md px-2 py-2 text-sm cursor-pointer"
                    >
                      {(Object.keys(PROGRAM_GOAL_KIND_LABEL) as ProgramGoalKind[]).map((kind) => (
                        <option key={kind} value={kind}>
                          {PROGRAM_GOAL_KIND_LABEL[kind]}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="col-span-4"
                      placeholder="Goal"
                      value={goalLabel}
                      onChange={(e) => setGoalLabel(e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Target"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                    />
                    <Input
                      className="col-span-1"
                      placeholder="lb"
                      value={goalUnit}
                      onChange={(e) => setGoalUnit(e.target.value)}
                    />
                    <Button
                      className="col-span-2 cursor-pointer"
                      size="sm"
                      disabled={savingGoal || !goalLabel.trim()}
                      onClick={handleAddGoal}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
