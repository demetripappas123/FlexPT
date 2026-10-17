'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import { notFound } from 'next/navigation'
import AssignWorkout from '@/modules/sessions/assignworkout'
import EditWorkout from '@/modules/sessions/editworkout'
import StartSession from '@/modules/sessions/startsession'
import Questionnaire from '@/modules/sessions/questionnaire'
import { Button } from '@/components/ui/button'
import RejectionReasonField from '@/modules/sessions/rejectionreason'
import { isProspectSessionType } from '@/supabase/utils/dashboardMetrics'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/solid'
import { fetchSessionById, fetchSessionWithExercises, SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { deleteSession } from '@/supabase/deletions/deletesession'
import { deleteWorkout } from '@/supabase/deletions/deleteworkout'
import { upsertSession, upsertSessionExercise, upsertExerciseSet } from '@/supabase/upserts/upsertsession'
import { SessionType } from '@/supabase/fetches/fetchsessions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getServerTime } from '@/supabase/utils/getServerTime'
import { formatRangeDisplay, parseRangeInput } from '@/supabase/utils/rangeparse'
import {
  markSessionCancelled,
  markSessionMissed,
  sessionLooksMissed,
  sessionMissedLabel,
  suggestMissedSessions,
} from '@/supabase/utils/sessionMissed'

export const dynamic = 'force-dynamic'

export default function EventPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [session, setSession] = useState<SessionWithExercises | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignWorkoutOpen, setAssignWorkoutOpen] = useState(false)
  const [assignInitialOption, setAssignInitialOption] = useState<'create' | 'program' | null>(null)
  const [editWorkoutOpen, setEditWorkoutOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [missedDialogOpen, setMissedDialogOpen] = useState(false)
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false)

  useEffect(() => {
    const loadSession = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      try {
        // Fetch the session directly by ID
        const sessionWithExercises = await fetchSessionWithExercises(id)
        if (sessionWithExercises) {
          const [synced] = await suggestMissedSessions([sessionWithExercises])
          setSession({ ...sessionWithExercises, missed: synced.missed })
        } else {
          setSession(null)
        }
      } catch (error) {
        console.error('Error loading session:', error)
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [id])

  // If starting session, show full-page view instead of normal page
  // Removed startSessionOpen overlay - clicking Start Session immediately sets status to in_progress
  // which triggers the in_progress conditional rendering below

  if (loading) {
    return (
      <main className="p-8 text-foreground bg-background min-h-screen">
        <div>Loading...</div>
      </main>
    )
  }

  if (!session) {
    return notFound()
  }

  // Calculate duration in minutes from started_at to end_time
  const calculateDuration = (startedAt: string | null, endTime: string | null): number | null => {
    if (!startedAt || !endTime) return null
    
    const start = new Date(startedAt)
    const end = new Date(endTime)
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
    
    // Calculate difference in milliseconds, then convert to minutes
    const diffMs = end.getTime() - start.getTime()
    const diffMinutes = Math.round(diffMs / (1000 * 60))
    
    // Return null if negative (shouldn't happen, but safety check)
    return diffMinutes >= 0 ? diffMinutes : null
  }

  // Check if this is a prospect session (not a client session)
  const isProspectSession = session.type !== 'Client Session'

  // Check if session is cancelled
  const isCancelled = session.status === 'canceled_with_charge' || session.status === 'canceled_no_charge'
  const isCompleted = session.status === 'completed'
  const isInProgress = session.status === 'in_progress'

  // Handle completed or cancelled status - show prescribed vs actual sets
  if (isCompleted || isCancelled) {
    return (
      <main className="p-8 text-foreground bg-background min-h-screen">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">{session.type}</h1>
          {isCancelled && (
            <span className={`px-3 py-1 rounded-md text-sm font-semibold ${
              session.missed === 'missed' || session.status === 'canceled_with_charge'
                ? 'bg-destructive/20 text-destructive border border-destructive/50' 
                : 'bg-primary/20 text-primary border border-primary/50'
            }`}>
              {session.rejection_reason
                ? session.rejection_reason
                : sessionMissedLabel(session) ??
                  (session.status === 'canceled_with_charge' ? 'Cancelled (With Charge)' : 'Cancelled (No Charge)')}
            </span>
          )}
        </div>

        <div className="space-y-2 text-muted-foreground mb-8">
          <p>
            <span className="font-semibold text-foreground">Scheduled:</span> {session.start_time ? new Date(session.start_time).toLocaleString() : 'No date'}
          </p>
          {session.started_at && (
            <p>
              <span className="font-semibold text-foreground">Started:</span> {new Date(session.started_at).toLocaleString()}
            </p>
          )}
          {(() => {
            const duration = calculateDuration(session.started_at, session.end_time)
            return duration !== null ? (
              <p>
                <span className="font-semibold text-foreground">Duration:</span> {duration} minutes
              </p>
            ) : null
          })()}
          <p>
            <span className="font-semibold text-foreground">Status:</span>{' '}
            {isCancelled ? (
              <span className={`capitalize ${
                session.status === 'canceled_with_charge' ? 'text-destructive' : 'text-primary'
              }`}>
                {session.status === 'canceled_with_charge' ? 'Cancelled (With Charge)' : 'Cancelled (No Charge)'}
              </span>
            ) : session.status === 'in_progress' ? (
              <span className="capitalize text-orange-500">In Progress</span>
            ) : session.status === 'completed' ? (
              <span className="capitalize text-green-500">Completed</span>
            ) : (
              <span className="capitalize text-muted-foreground">
                {sessionMissedLabel(session) ?? 'Pending'}
              </span>
            )}
          </p>
          {isProspectSessionType(session.type) && !session.converted && (
            <div className="max-w-md pt-2">
              <RejectionReasonField
                value={rejectionReason || session.rejection_reason || ''}
                onChange={setRejectionReason}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2 cursor-pointer"
                onClick={async () => {
                  try {
                    await upsertSession({
                      id: session.id,
                      type: session.type,
                      rejection_reason: rejectionReason || session.rejection_reason || '',
                    })
                    const next = await fetchSessionWithExercises(session.id)
                    if (next) setSession(next)
                  } catch (error) {
                    console.error(error)
                    alert('Could not save the rejection reason.')
                  }
                }}
              >
                Save reason
              </Button>
            </div>
          )}
        </div>

        {/* Display completed workout with actual sets */}
        {session.exercises && session.exercises.length > 0 ? (
          <div className="mt-8 bg-card border border-border rounded-lg p-6">
            <h2 className="text-[22px] font-normal tracking-tight text-foreground mb-6">Completed Workout</h2>
            <div className="space-y-6">
              {session.exercises.map((exercise, idx) => (
                <div key={exercise.id || idx} className="bg-background rounded-md p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {exercise.position + 1}. {exercise.exercise_name || 'Unknown Exercise'}
                    </h3>
                    {exercise.notes && (
                      <p className="text-sm text-muted-foreground">{exercise.notes}</p>
                    )}
                  </div>
                  {exercise.sets && exercise.sets.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
                        <div>Set</div>
                        <div>Weight</div>
                        <div>Reps</div>
                        <div>RIR</div>
                        <div>RPE</div>
                        <div>Notes</div>
                        <div>Done</div>
                      </div>
                      {exercise.sets.map((set, setIdx) => (
                        <div key={set.id || setIdx} className="grid grid-cols-7 gap-2 text-sm text-muted-foreground">
                          <div>{set.set_number}</div>
                          <div className={set.weight !== null ? 'text-foreground font-medium' : ''}>{set.weight ?? '-'}</div>
                          <div className={set.reps !== null ? 'text-foreground font-medium' : ''}>{set.reps ?? '-'}</div>
                          <div className={set.rir !== null ? 'text-foreground font-medium' : ''}>{set.rir ?? '-'}</div>
                          <div className={set.rpe !== null ? 'text-foreground font-medium' : ''}>{set.rpe ?? '-'}</div>
                          <div className="text-xs">{set.notes || '-'}</div>
                          <div>{set.completed ? '✓' : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-card border border-border rounded-lg p-6">
            <h2 className="text-[22px] font-normal tracking-tight text-foreground mb-2">Completed Workout</h2>
            <p className="text-muted-foreground">No workout data available for this session.</p>
          </div>
        )}
      </main>
    )
  }

  // Handle in_progress status - show StartSession component directly
  if (isInProgress) {
    return (
      <>
        {session && (
          <StartSession
            session={session}
            onSessionStart={async () => {
              // Set started_at when session actually starts (if not already set)
              // Use server time to avoid client clock issues
              if (!session.started_at) {
                const currentTime = await getServerTime()
                await upsertSession({
                  id: session.id,
                  type: session.type,
                  person_id: session.person_id,
                  trainer_id: session.trainer_id,
                  start_time: session.start_time, // Keep scheduled time
                  started_at: currentTime, // Set actual start time from server
                  workout_id: session.workout_id,
                  converted: session.converted,
                  status: 'in_progress', // Keep status as in_progress
                  missed: null,
                })
                // Reload session data
                const sessionWithExercises = await fetchSessionWithExercises(id)
                if (sessionWithExercises) {
                  setSession(sessionWithExercises)
                }
              }
            }}
            onSessionComplete={async () => {
              // Reload session data
              const sessionWithExercises = await fetchSessionWithExercises(id)
              if (sessionWithExercises) {
                setSession(sessionWithExercises)
              }
            }}
            onCancel={async () => {
              // Don't clear localStorage on cancel - user might come back
              // Just reload the session data
              const sessionWithExercises = await fetchSessionWithExercises(id)
              if (sessionWithExercises) {
                setSession(sessionWithExercises)
              }
            }}
            onSessionCancel={async (withCharge: boolean) => {
              // Cancel the session with or without charge
              try {
                await markSessionCancelled(session, withCharge)
                // Reload session data
                const sessionWithExercises = await fetchSessionWithExercises(id)
                if (sessionWithExercises) {
                  setSession(sessionWithExercises)
                }
              } catch (error) {
                console.error('Error canceling session:', error)
                throw error
              }
            }}
          />
        )}
      </>
    )
  }

  // Handle pending status - show normal UI
  return (
    <main className="p-8 text-foreground bg-background min-h-screen">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-[26px] font-normal tracking-tight text-foreground">{session.type}</h1>
        {(session.missed === 'suggested' || sessionLooksMissed(session)) && (
          <span className="px-3 py-1 rounded-md text-sm font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/50">
            Looks missed
          </span>
        )}
      </div>

      <div className="space-y-2 text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Scheduled:</span> {session.start_time ? new Date(session.start_time).toLocaleString() : 'No date'}
        </p>
        <p>
          <span className="font-semibold text-foreground">Status:</span>{' '}
          {isCancelled ? (
            <span className={`capitalize ${
              session.status === 'canceled_with_charge' ? 'text-destructive' : 'text-primary'
            }`}>
              {session.status === 'canceled_with_charge' ? 'Cancelled (With Charge)' : 'Cancelled (No Charge)'}
            </span>
          ) : session.missed === 'suggested' || sessionLooksMissed(session) ? (
            <span className="text-amber-500">Looks missed</span>
          ) : (
            <span className="capitalize text-yellow-500">Pending</span>
          )}
        </p>
      </div>

      {!isCancelled && !session.workout_id && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            Attach a workout from this client's assigned program, or design one on the fly. Then start the session around the scheduled time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => {
                setAssignInitialOption('program')
                setAssignWorkoutOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              Assign from program
            </Button>
            <Button
              onClick={() => {
                setAssignInitialOption('create')
                setAssignWorkoutOpen(true)
              }}
              variant="outline"
              className="cursor-pointer"
            >
              Design on the fly
            </Button>
          </div>
        </div>
      )}

      {/* Display assigned workout */}
      {session && session.workout_id && (
        <div className="mt-8 bg-card border border-border rounded-lg p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[22px] font-normal tracking-tight text-foreground">Assigned Workout</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditWorkoutOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Edit Workout"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="p-2 text-destructive hover:text-destructive/80 cursor-pointer transition-colors"
                title="Unassign Workout"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          {session.exercises && session.exercises.length > 0 ? (
            <div className="space-y-6">
              {session.exercises.map((exercise, idx) => (
              <div key={exercise.id || idx} className="bg-background rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {exercise.position + 1}. {exercise.exercise_name || 'Unknown Exercise'}
                  </h3>
                  {exercise.notes && (
                    <p className="text-sm text-muted-foreground">{exercise.notes}</p>
                  )}
                </div>
                {exercise.sets && exercise.sets.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
                      <div>Set</div>
                      <div>Weight</div>
                      <div>Reps</div>
                      <div>RIR</div>
                      <div>RPE</div>
                      <div>Notes</div>
                    </div>
                    {exercise.sets.map((set, setIdx) => (
                      <div key={set.id || setIdx} className="grid grid-cols-6 gap-2 text-sm text-muted-foreground">
                        <div>{set.set_number}</div>
                        <div>{set.weight ?? '-'}</div>
                        <div>{set.reps ?? '-'}</div>
                        <div>{set.rir ?? '-'}</div>
                        <div>{set.rpe ?? '-'}</div>
                        <div className="text-xs">{set.notes || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">
              <p>No exercises assigned yet. Click the pencil icon to add exercises.</p>
            </div>
          )}
        </div>
      )}

      {/* Questionnaire - only for prospect sessions, must be completed before starting workout */}
      {isProspectSession && session.person_id && (
        <Questionnaire 
          sessionId={session.id} 
          prospectId={session.person_id}
          onCompletionChange={setQuestionnaireCompleted}
        />
      )}

      {/* Action buttons at the bottom - only show if not cancelled */}
      {!isCancelled && (
        <div className="mt-8 flex flex-col gap-4">
          {/* Start Session button */}
          {/* For prospect sessions: only require questionnaire to be completed (workout not required) */}
          {/* For client sessions: require workout to be assigned */}
          {((isProspectSession && questionnaireCompleted) || 
            (!isProspectSession && session && session.exercises && session.exercises.length > 0)) && (
            <Button
              onClick={async () => {
                // Update session status to in_progress immediately and redirect to in_progress view
                if (session && session.status !== 'in_progress') {
                  try {
                    const currentTime = await getServerTime()
                    await upsertSession({
                      id: session.id,
                      type: session.type,
                      person_id: session.person_id,
                      trainer_id: session.trainer_id,
                      start_time: session.start_time,
                      started_at: session.started_at || currentTime, // Set started_at if not already set
                      workout_id: session.workout_id,
                      converted: session.converted,
                      status: 'in_progress', // Set status to in_progress when Start Session button is clicked
                      missed: null,
                    })
                    // Reload session data to reflect the status change and trigger in_progress view
                    const sessionWithExercises = await fetchSessionWithExercises(id)
                    if (sessionWithExercises) {
                      setSession(sessionWithExercises)
                    }
                  } catch (error) {
                    console.error('Error updating session status:', error)
                  }
                }
              }}
              className="w-full cursor-pointer"
            >
              Start Session
            </Button>
          )}
          <Button
            onClick={() => setMissedDialogOpen(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black cursor-pointer"
          >
            Mark as missed
          </Button>
          <Button
            onClick={() => setCancelDialogOpen(true)}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
          >
            Cancel Session
          </Button>
        </div>
      )}

      <AssignWorkout
        open={assignWorkoutOpen}
        initialOption={assignInitialOption}
        onOpenChange={(open) => {
          setAssignWorkoutOpen(open)
          if (!open) {
            setAssignInitialOption(null)
            const reloadSession = async () => {
              const sessionWithExercises = await fetchSessionWithExercises(id)
              if (sessionWithExercises) {
                setSession(sessionWithExercises)
              } else {
                setSession(null)
              }
            }
            reloadSession()
          }
        }}
        sessionId={id}
        sessionType={session.type}
        personId={session.person_id}
      />

      {/* Edit Workout Dialog - opens directly when editing existing session */}
      {session && (
        <EditWorkout
          open={editWorkoutOpen}
          onOpenChange={(open) => {
            setEditWorkoutOpen(open)
            // Reload session data when dialog closes
            if (!open) {
              const reloadSession = async () => {
                const sessionWithExercises = await fetchSessionWithExercises(id)
                if (sessionWithExercises) {
                  setSession(sessionWithExercises)
                } else {
                  setSession(null)
                }
              }
              reloadSession()
            }
          }}
          sessionId={session.id}
          initialExercises={session.exercises || []}
          sessionStatus={session.status}
          mode="edit"
          onSave={async (data) => {
            if (!session) return

            try {
              if (!session.workout_id) {
                throw new Error('Session has no workout assigned')
              }

              // Update the session (keep the same workout_id)
              await upsertSession({
                id: session.id,
                person_id: session.person_id,
                trainer_id: session.trainer_id,
                type: session.type,
                start_time: data.sessionUpdates?.start_time ?? session.start_time,
                started_at: session.started_at,
                end_time: data.sessionUpdates?.end_time ?? session.end_time,
                workout_id: session.workout_id, // Keep the same workout_id
                converted: session.converted,
                status: session.status || 'pending',
                person_package_id: session.person_package_id,
              })

              // Use smart update to update exercises and sets (keeps workout_id, updates as needed)
              const exerciseData = data.exercises.map((ex, index) => ({
                exercise_id: ex.exercise_id,
                position: index,
                notes: ex.notes || null,
              }))

              // Upsert exercises using smart update (compares and updates/inserts/deletes as needed)
              const { upsertWorkoutExercises, upsertExerciseSets } = await import('@/supabase/upserts/upsertsession')
              const updatedExercises = await upsertWorkoutExercises(session.workout_id, exerciseData)

              // Update sets for each exercise using smart update
              for (let i = 0; i < data.exercises.length; i++) {
                const exercise = data.exercises[i]
                const updatedExercise = updatedExercises[i]
                
                if (updatedExercise && updatedExercise.id && exercise.sets && exercise.sets.length > 0) {
                  const setData = exercise.sets.map((set, idx) => ({
                    set_number: idx + 1, // Re-number sets sequentially
                    // Convert number inputs to numrange format for database
                    weight: set.weight !== null && set.weight !== undefined ? parseRangeInput(String(set.weight)) : null,
                    reps: set.reps !== null && set.reps !== undefined ? parseRangeInput(String(set.reps)) : null,
                    rir: set.rir !== null && set.rir !== undefined ? parseRangeInput(String(set.rir)) : null,
                    rpe: set.rpe !== null && set.rpe !== undefined ? parseRangeInput(String(set.rpe)) : null,
                    notes: set.notes ?? null,
                  }))

                  // Use smart update for sets (compares and updates/inserts/deletes as needed)
                  await upsertExerciseSets(updatedExercise.id, setData)
                }
              }
            } catch (error) {
              console.error('Error saving workout:', error)
              alert('Error saving workout. Please try again.')
              throw error
            }
          }}
        />
      )}

      {/* Unassign Workout Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Unassign Workout</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to unassign this workout from the session? The session will be kept, but the workout will no longer be associated with it. The workout data will remain in the database for history purposes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="cursor-pointer bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!session || !session.workout_id) return
                try {
                  const workoutIdToDelete = session.workout_id
                  
                  // Step 1: Update session to remove workout_id (set to null)
                  // This keeps the session but unlinks it from the workout
                  // IMPORTANT: Update session FIRST before deleting workout to avoid any constraint issues
                  const updatedSession = await upsertSession({
                    id: session.id,
                    type: session.type,
                    person_id: session.person_id,
                    trainer_id: session.trainer_id,
                    start_time: session.start_time,
                    started_at: session.started_at,
                    end_time: session.end_time,
                    workout_id: null, // Unassign the workout - set to null
                    converted: session.converted,
                    status: session.status || 'pending',
                    person_package_id: session.person_package_id,
                  })
                  
                  console.log('Session updated, workout_id set to null:', updatedSession)
                  
                  // Step 2: Delete the workout entry (this will cascade delete workout_exercises and exercise_sets)
                  // The workout is now unlinked from the session, so deleting it won't affect the session
                  await deleteWorkout(workoutIdToDelete)
                  
                  console.log('Workout deleted:', workoutIdToDelete)
                  
                  // Reload session data to reflect the change
                  const sessionWithExercises = await fetchSessionWithExercises(id)
                  if (sessionWithExercises) {
                    console.log('Reloaded session after unassign:', sessionWithExercises)
                    setSession(sessionWithExercises)
                  } else {
                    console.error('Failed to reload session after unassign - session not found')
                    // Try to fetch just the session without exercises
                    const basicSession = await fetchSessionById(id)
                    if (basicSession) {
                      setSession({ ...basicSession, exercises: [] })
                    } else {
                      console.error('Session not found after unassigning workout')
                      alert('Warning: Session may have been affected. Please refresh the page.')
                    }
                  }
                  
                  setDeleteDialogOpen(false)
                  alert('Workout unassigned successfully')
                } catch (error) {
                  console.error('Error unassigning workout:', error)
                  alert(`Error unassigning workout: ${error instanceof Error ? error.message : 'Please try again.'}`)
                }
              }}
              className="cursor-pointer bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Unassign Workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Session Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cancel Session</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              How would you like to cancel this session?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {session && isProspectSessionType(session.type) && (
              <RejectionReasonField value={rejectionReason} onChange={setRejectionReason} />
            )}
            <Button
              type="button"
              onClick={async () => {
                try {
                  if (!session) return
                  // Mark session as cancelled with charge (update status)
                  await markSessionCancelled(session, true, rejectionReason)
                  
                  setCancelDialogOpen(false)
                  alert('Session canceled with charge')
                  // Reload session data
                  const sessionWithExercises = await fetchSessionWithExercises(session.id)
                  if (sessionWithExercises) {
                    setSession(sessionWithExercises)
                  }
                } catch (error) {
                  console.error('Error canceling session:', error)
                  alert('Error canceling session. Please try again.')
                }
              }}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              Cancel with Charge
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  if (!session) return
                  // Mark session as cancelled without charge (update status)
                  await markSessionCancelled(session, false, rejectionReason)
                  
                  setCancelDialogOpen(false)
                  alert('Session canceled without charge')
                  // Reload session data
                  const sessionWithExercises = await fetchSessionWithExercises(session.id)
                  if (sessionWithExercises) {
                    setSession(sessionWithExercises)
                  }
                } catch (error) {
                  console.error('Error canceling session:', error)
                  alert('Error canceling session. Please try again.')
                }
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              Cancel without Charge
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              className="cursor-pointer bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Close
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

      <Dialog open={missedDialogOpen} onOpenChange={setMissedDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Mark as missed</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              No-show. Charge burns a package unit; no charge does not.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {session && isProspectSessionType(session.type) && (
              <RejectionReasonField value={rejectionReason} onChange={setRejectionReason} />
            )}
            <Button
              type="button"
              onClick={async () => {
                try {
                  if (!session) return
                  await markSessionMissed(session, true, rejectionReason)
                  setMissedDialogOpen(false)
                  const sessionWithExercises = await fetchSessionWithExercises(session.id)
                  if (sessionWithExercises) setSession(sessionWithExercises)
                } catch (error) {
                  console.error('Error marking session missed:', error)
                  alert('Error marking session missed. Please try again.')
                }
              }}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
            >
              Missed with charge
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  if (!session) return
                  await markSessionMissed(session, false, rejectionReason)
                  setMissedDialogOpen(false)
                  const sessionWithExercises = await fetchSessionWithExercises(session.id)
                  if (sessionWithExercises) setSession(sessionWithExercises)
                } catch (error) {
                  console.error('Error marking session missed:', error)
                  alert('Error marking session missed. Please try again.')
                }
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              Missed without charge
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMissedDialogOpen(false)}
              className="cursor-pointer bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  )
}
