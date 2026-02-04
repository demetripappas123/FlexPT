'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import { Person } from '@/supabase/fetches/fetchpeople'
import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'
import { updateNutritionEntries } from '@/supabase/upserts/upsertnutrition'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'
import { fetchSessionWithExercises, SessionWithExercises, Session } from '@/supabase/fetches/fetchsessions'
import { WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { upsertWorkout } from '@/supabase/upserts/upsertworkout'
import { Plus } from 'lucide-react'
import WorkoutVolumeChart from '@/modules/clients/workoutvolumechart'
import RPERIRChart from '@/modules/clients/rperirchart'
import WeightProgressionChart from '@/modules/clients/weightprogressionchart'
import Packages from '@/modules/clients/packages'
import Payments from '@/modules/clients/payments'
import Contracts from '@/modules/clients/contracts'
import EditWorkout from '@/modules/sessions/editworkout'
import AddEventDialog from '@/modules/calendar/addevent'
import WorkoutCalendar from '@/modules/clients/workoutcalendar'
import AssignProgramWorkout from '@/modules/clients/assignprogramworkout'
import { upsertSession, upsertSessionExercise, upsertExerciseSet, upsertWorkoutExercises, upsertExerciseSets } from '@/supabase/upserts/upsertsession'
import { parseRangeInput, formatRangeDisplay } from '@/supabase/utils/rangeparse'
import { upsertClient } from '@/supabase/upserts/upsertperson'
import { Utensils, Dumbbell, Pencil, Activity, UserCheck, Plus as PlusIcon, Trash, X, Box, DollarSign, FileText, Calendar, List, Check } from 'lucide-react'
import { AssignedMeal, fetchAssignedMeals } from '@/supabase/fetches/fetchassignedmeals'
import AssignMealDialogContent from '@/modules/clients/assignmealdialog'
import { useAuth } from '@/context/authcontext'
import NutritionOverview from '@/modules/clients/nutritionoverview'
import NutritionSubTabs from '@/modules/clients/nutritionsubtabs'
import MealsManagement from '@/modules/clients/mealsmanagement'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { PersonPackage } from '@/supabase/fetches/fetchpersonpackages'
import { Payment } from '@/supabase/fetches/fetchpayments'
import { Package as PackageType } from '@/supabase/fetches/fetchpackages'
import { Contract } from '@/supabase/fetches/fetchcontracts'
import { fetchPersonWithWorkouts } from '@/supabase/fetches/fetchpersonwithdata'
import { fetchPersonPackagesByPersonId } from '@/supabase/fetches/fetchpersonpackages'
import { fetchPaymentsByPersonId } from '@/supabase/fetches/fetchpayments'
import { fetchClientNutritionGoals } from '@/supabase/fetches/fetchnutritiongoals'
import { fetchClientNutritionEntries } from '@/supabase/fetches/fetchnutrition'
import { fetchContractsByPersonId } from '@/supabase/fetches/fetchcontracts'
import { fetchPackages } from '@/supabase/fetches/fetchpackages'
import { fetchPersonWorkoutsWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { updateWorkout } from '@/supabase/upserts/upsertworkout'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'


export default function PersonPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [person, setPerson] = useState<Person | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [workouts, setWorkouts] = useState<WorkoutWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingNutrition, setIsEditingNutrition] = useState(false)
  const [activeTab, setActiveTab] = useState<'nutrition' | 'sessions' | 'workouts' | 'progress' | 'packages' | 'payments' | 'contracts'>('progress')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [showAddWorkoutForm, setShowAddWorkoutForm] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [workoutView, setWorkoutView] = useState<'list' | 'calendar'>('calendar')
  const [assignProgramWorkoutOpen, setAssignProgramWorkoutOpen] = useState(false)
  const [assignProgramWorkoutDate, setAssignProgramWorkoutDate] = useState<string | undefined>(undefined)
  
  // Add workout form state
  const [newWorkoutDate, setNewWorkoutDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [newWorkoutExercises, setNewWorkoutExercises] = useState<Array<{
    exercise_id: string
    exercise_name: string
    notes: string
    sets: Array<{
      set_number: number
      weight: string | null // numrange in PostgreSQL format
      reps: string | null // numrange in PostgreSQL format
      rir: string | null // numrange in PostgreSQL format
      rpe: string | null // numrange in PostgreSQL format
      notes: string | null
    }>
  }>>([])
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({})
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({})
  
  // Cached data for tabs (loaded on-demand)
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[] | null>(null)
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoal[] | null>(null)
  const [personPackages, setPersonPackages] = useState<PersonPackage[] | null>(null)
  const [packages, setPackages] = useState<PackageType[] | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [assignedMeals, setAssignedMeals] = useState<AssignedMeal[] | null>(null)
  
  // Loading states for each tab
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [contractsLoading, setContractsLoading] = useState(false)
  
  // Meal view state
  const [mealView, setMealView] = useState<'list' | 'calendar'>('calendar')
  const [nutritionSubTab, setNutritionSubTab] = useState<'overview' | 'meals'>('overview')
  const [assignMealOpen, setAssignMealOpen] = useState(false)
  const [assignMealDate, setAssignMealDate] = useState<string | undefined>(undefined)

  const isClient = person?.converted_at !== null && person?.converted_at !== undefined
  const isProspect = !isClient

  useEffect(() => {
    const loadPerson = async () => {
      const personId = params.id
      if (!personId) return setLoading(false)

      setLoading(true)
      try {
        // Minimal fetch: only person, sessions, and workouts (for progress tab)
        const personData = await fetchPersonWithWorkouts(personId as string)

        if (!personData.person) {
          setPerson(null)
          return
        }

        setPerson(personData.person)
        setSessions(personData.sessions)
        console.log('Fetched workouts for person:', personData.person.id, personData.workouts.length, personData.workouts)
        setWorkouts(personData.workouts)
      } catch (err) {
        console.error('Unexpected error loading person:', err)
        setPerson(null)
      } finally {
        setLoading(false)
      }
    }

    loadPerson()
  }, [params.id])

  // Load nutrition data when nutrition tab is activated
  useEffect(() => {
    const loadNutritionData = async () => {
      if (activeTab !== 'nutrition' || !person) return
      const isClient = person.converted_at !== null && person.converted_at !== undefined
      if (!isClient) return
      // If already loaded, don't reload
      if (nutritionEntries !== null && nutritionGoals !== null) return

      setNutritionLoading(true)
      try {
        const [entries, goals] = await Promise.all([
          fetchClientNutritionEntries(person.id),
          fetchClientNutritionGoals(person.id),
        ])
        setNutritionEntries(entries)
        setNutritionGoals(goals)
      } catch (err) {
        console.error('Error loading nutrition data:', err)
        setNutritionEntries([])
        setNutritionGoals([])
      } finally {
        setNutritionLoading(false)
      }
    }

    loadNutritionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, person?.id])

  // Load assigned meals when meals sub-tab is activated
  useEffect(() => {
    const loadAssignedMeals = async () => {
      if (activeTab !== 'nutrition' || nutritionSubTab !== 'meals' || !person) return
      const isClient = person.converted_at !== null && person.converted_at !== undefined
      if (!isClient) return
      // If already loaded, don't reload
      if (assignedMeals !== null) return

      setNutritionLoading(true)
      try {
        const meals = await fetchAssignedMeals(person.id)
        setAssignedMeals(meals)
      } catch (err) {
        console.error('Error loading assigned meals:', err)
        setAssignedMeals([])
      } finally {
        setNutritionLoading(false)
      }
    }

    loadAssignedMeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, nutritionSubTab, person?.id])

  // Load packages data when packages tab is activated
  useEffect(() => {
    const loadPackagesData = async () => {
      if (activeTab !== 'packages' || !person) return
      const isClient = person.converted_at !== null && person.converted_at !== undefined
      if (!isClient) return
      // If already loaded, don't reload
      if (personPackages !== null && packages !== null) return

      setPackagesLoading(true)
      try {
        const [ppData, pkgData] = await Promise.all([
          fetchPersonPackagesByPersonId(person.id),
          fetchPackages(),
        ])
        setPersonPackages(ppData)
        setPackages(pkgData)
      } catch (err) {
        console.error('Error loading packages data:', err)
        setPersonPackages([])
        setPackages([])
      } finally {
        setPackagesLoading(false)
      }
    }

    loadPackagesData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, person?.id])

  // Load payments data when payments tab is activated
  useEffect(() => {
    const loadPaymentsData = async () => {
      if (activeTab !== 'payments' || !person) return
      const isClient = person.converted_at !== null && person.converted_at !== undefined
      if (!isClient) return
      // If already loaded, don't reload
      if (payments !== null && personPackages !== null && packages !== null) return

      setPaymentsLoading(true)
      try {
        // Payments tab needs payments, personPackages, and packages
        const [paymentsData, ppData, pkgData] = await Promise.all([
          fetchPaymentsByPersonId(person.id),
          personPackages === null ? fetchPersonPackagesByPersonId(person.id) : Promise.resolve(personPackages),
          packages === null ? fetchPackages() : Promise.resolve(packages),
        ])
        setPayments(paymentsData)
        // Update caches if they were null
        if (personPackages === null) setPersonPackages(ppData)
        if (packages === null) setPackages(pkgData)
      } catch (err) {
        console.error('Error loading payments data:', err)
        setPayments([])
      } finally {
        setPaymentsLoading(false)
      }
    }

    loadPaymentsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, person?.id])

  // Load contracts data when contracts tab is activated
  useEffect(() => {
    const loadContractsData = async () => {
      if (activeTab !== 'contracts' || !person) return
      const isClient = person.converted_at !== null && person.converted_at !== undefined
      if (!isClient) return
      // If already loaded, don't reload
      if (contracts !== null && packages !== null) return

      setContractsLoading(true)
      try {
        const [contractsData, pkgData] = await Promise.all([
          fetchContractsByPersonId(person.id),
          packages === null ? fetchPackages() : Promise.resolve(packages),
        ])
        setContracts(contractsData)
        // Update cache if it was null
        if (packages === null) setPackages(pkgData)
      } catch (err) {
        console.error('Error loading contracts data:', err)
        setContracts([])
      } finally {
        setContractsLoading(false)
      }
    }

    loadContractsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, person?.id])

  // Prevent body scroll when edit overlay is open
  useEffect(() => {
    if (editingWorkoutId && editingWorkoutId !== 'new') {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [editingWorkoutId])

  // Load exercise library when add workout form is shown
  useEffect(() => {
    const loadExerciseLibrary = async () => {
      if (showAddWorkoutForm) {
        console.log('Loading exercise library for workout form...')
        try {
          const exercises = await fetchExercises()
          console.log('Exercise library loaded:', exercises.length, 'exercises')
          setExerciseLibrary(exercises)
    } catch (err) {
          console.error('Error loading exercise library:', err)
          setExerciseLibrary([])
        }
      } else {
        // Clear when form is closed
        setExerciseLibrary([])
      }
    }
    loadExerciseLibrary()
  }, [showAddWorkoutForm])

  const handleConvertToClient = () => {
    if (!person) return
    // Redirect to conversion page
    router.push(`/conversion/${person.id}`)
  }

  const handleSaveNutrition = async (
    entries: Omit<NutritionEntry, 'id' | 'created_at' | 'updated_at'>[]
  ) => {
    if (!person || !isClient) return

    try {
      const updated = await updateNutritionEntries(person.id, entries)
      if (updated) {
        setNutritionEntries(updated)
        setIsEditingNutrition(false)
      }
    } catch (err) {
      console.error('Failed to save nutrition entries:', err)
      throw err
    }
  }

  const handleRefreshPayments = async () => {
    if (!person) return
    try {
      const [paymentsData, personPackagesData] = await Promise.all([
        fetchPaymentsByPersonId(person.id),
        fetchPersonPackagesByPersonId(person.id),
      ])
      setPayments(paymentsData || [])
      setPersonPackages(personPackagesData || [])
    } catch (err) {
      console.error('Error reloading payments:', err)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>
  if (!person) return <p className="text-muted-foreground">Person not found.</p>

  // Prospect UI (simple)
  if (isProspect) {
    return (
      <div className="p-6 space-y-4 bg-background min-h-screen text-foreground">
        <button
          onClick={() => router.back()}
          className="px-3 py-1 bg-muted rounded-md hover:bg-muted/80 cursor-pointer"
        >
          ← Back
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold mb-4">{person.name}</h1>
          <Button
            onClick={handleConvertToClient}
            className="bg-green-600 hover:bg-green-700 text-white cursor-pointer flex items-center gap-2"
          >
            <UserCheck className="h-5 w-5" />
            Convert to Client
          </Button>
        </div>

        <div className="p-4 bg-card border border-border rounded-md">
          <p className="text-muted-foreground mb-2">
            <span className="font-semibold text-foreground">Number:</span> {person.number || 'N/A'}
          </p>
          {person.notes && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Notes:</span> {person.notes}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Client UI (full featured)
  return (
    <div className="p-6 space-y-4 bg-background min-h-screen text-foreground">
      <button
        onClick={() => router.back()}
        className="px-3 py-1 bg-muted rounded-md hover:bg-muted/80 cursor-pointer"
      >
        ← Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">{person.name}</h1>
        {isClient && (
          <AddEventDialog
            initialPersonId={person.id}
            initialType="Client Session"
            trigger={
              <button
                className="p-2 bg-muted hover:bg-muted/80 rounded-md text-foreground cursor-pointer transition-colors"
                title="Schedule New Session"
              >
                <Calendar className="h-5 w-5" />
              </button>
            }
          />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'progress'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-muted-foreground hover:text-foreground'
          } cursor-pointer`}
        >
          <Activity className="h-5 w-5" />
          Progress
        </button>
        <button
          onClick={() => setActiveTab('nutrition')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'nutrition'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-muted-foreground hover:text-foreground'
          } cursor-pointer`}
        >
          <Utensils className="h-5 w-5" />
          Nutrition
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-muted-foreground hover:text-foreground'
          } cursor-pointer`}
        >
          <FileText className="h-5 w-5" />
          Session History
        </button>
        <button
          onClick={() => setActiveTab('workouts')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
            activeTab === 'workouts'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-muted-foreground hover:text-foreground'
          } cursor-pointer`}
        >
          <Dumbbell className="h-5 w-5" />
          Workouts
        </button>
        {isClient && (
          <>
            <button
              onClick={() => setActiveTab('packages')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                activeTab === 'packages'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-muted-foreground hover:text-foreground'
              } cursor-pointer`}
            >
              <Box className="h-5 w-5" />
              Packages
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                activeTab === 'payments'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-muted-foreground hover:text-foreground'
              } cursor-pointer`}
            >
              <DollarSign className="h-5 w-5" />
              Payments
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                activeTab === 'contracts'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-muted-foreground hover:text-foreground'
              } cursor-pointer`}
            >
              <FileText className="h-5 w-5" />
              Contracts
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'nutrition' && (
        <>
          {nutritionLoading ? (
            <div className="p-4 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Loading nutrition data...</p>
            </div>
          ) : (
            <>
              <NutritionSubTabs
                activeTab={nutritionSubTab}
                onTabChange={setNutritionSubTab}
              />

              {nutritionSubTab === 'overview' && (
                <NutritionOverview
                  clientId={person.id}
                  nutritionEntries={nutritionEntries || []}
                  nutritionGoals={nutritionGoals || []}
                  isEditingNutrition={isEditingNutrition}
                  onEditClick={() => setIsEditingNutrition(true)}
                  onSave={handleSaveNutrition}
                  onCancel={() => setIsEditingNutrition(false)}
                  onGoalsUpdate={setNutritionGoals}
                />
              )}

              {nutritionSubTab === 'meals' && (
                <MealsManagement
                  assignedMeals={assignedMeals}
                  personId={person.id}
                  mealView={mealView}
                  onMealViewChange={setMealView}
                  onAssignMealClick={() => {
                    setAssignMealDate(undefined)
                    setAssignMealOpen(true)
                  }}
                  onDateClick={(date) => {
                    setAssignMealDate(date.toISOString().split('T')[0])
                    setAssignMealOpen(true)
                  }}
                  onMealUpdate={async (meals) => {
                    setAssignedMeals(meals)
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'sessions' && (
        <div className="p-4 bg-card border border-border rounded-md">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Session History {sessions.length > 0 && `(${sessions.length} sessions)`}
          </h2>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground">No sessions found.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-background border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {session.type}
                      </h3>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-semibold text-foreground">Scheduled:</span>{' '}
                        {session.start_time
                          ? new Date(session.start_time).toLocaleString()
                          : 'No date'}
                      </p>
                        {session.started_at && (
                          <p>
                            <span className="font-semibold text-foreground">Started:</span>{' '}
                            {new Date(session.started_at).toLocaleString()}
                          </p>
                        )}
                        {session.end_time && (
                          <p>
                            <span className="font-semibold text-foreground">Ended:</span>{' '}
                            {new Date(session.end_time).toLocaleString()}
                          </p>
                        )}
                      {session.started_at && session.end_time && (() => {
                        const startTime = new Date(session.started_at).getTime()
                        const endTime = new Date(session.end_time).getTime()
                        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60))
                        return (
                            <p>
                              <span className="font-semibold text-foreground">Duration:</span> {durationMinutes} minutes
                          </p>
                        )
                      })()}
                        {session.workout_id && (
                          <p className="text-xs text-orange-400 mt-2">
                            ✓ Workout assigned
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'workouts' && (
        <div className="p-4 bg-card border border-border rounded-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Workouts {workouts.length > 0 && `(${workouts.length} workouts)`}
            </h2>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-md p-1">
                <button
                  onClick={() => setWorkoutView('list')}
                  className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
                    workoutView === 'list'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setWorkoutView('calendar')}
                  className={`px-3 py-1 rounded text-sm transition-colors cursor-pointer ${
                    workoutView === 'calendar'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                </button>
              </div>
              <Button
                onClick={() => {
                  setAssignProgramWorkoutDate(undefined)
                  setAssignProgramWorkoutOpen(true)
                }}
                variant="outline"
                className="bg-card hover:bg-muted text-foreground border-border cursor-pointer"
              >
                <Box className="h-4 w-4 mr-2" />
                Assign from Program
              </Button>
              <Button
                onClick={() => setShowAddWorkoutForm(!showAddWorkoutForm)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                {showAddWorkoutForm ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Workout
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Inline Add Workout Form */}
          {showAddWorkoutForm && (
            <div className="mb-6 bg-background border border-border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add New Workout</h3>
              
              {/* Workout Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Workout Date *
                </label>
                <Input
                  type="date"
                  value={newWorkoutDate}
                  onChange={(e) => setNewWorkoutDate(e.target.value)}
                  className="bg-card text-foreground border-border max-w-xs cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
                  required
                />
              </div>

              {/* Exercises */}
              <div className="space-y-4 mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Exercises</label>
                  <Button
                    type="button"
                    onClick={() => {
                      setNewWorkoutExercises([...newWorkoutExercises, {
                        exercise_id: '',
                        exercise_name: '',
                        notes: '',
                        sets: [],
                      }])
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-auto cursor-pointer"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Add Exercise
                  </Button>
                </div>

                {newWorkoutExercises.map((exercise, exIdx) => (
                  <div key={exIdx} className="bg-muted border border-border rounded-md p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1 text-muted-foreground">
                          Exercise {exIdx + 1}
                        </label>
                        <div className="relative">
                          <Command className="bg-background border border-border">
                            <CommandInput
                              placeholder="Search exercises..."
                              value={searchValue[exIdx] || exercise.exercise_name || ''}
                              onValueChange={(value) => {
                                setSearchValue({ ...searchValue, [exIdx]: value })
                                const updated = [...newWorkoutExercises]
                                updated[exIdx].exercise_name = value
                                setNewWorkoutExercises(updated)
                                if (exerciseLibrary.length > 0) {
                                  setOpenCombobox({ ...openCombobox, [exIdx]: true })
                                }
                              }}
                              onFocus={() => {
                                if (exerciseLibrary.length > 0) {
                                  setOpenCombobox({ ...openCombobox, [exIdx]: true })
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setOpenCombobox((prev) => ({ ...prev, [exIdx]: false }))
                                }, 200)
                              }}
                              className="text-foreground bg-background"
                            />
                            {openCombobox[exIdx] && exerciseLibrary.length > 0 && (
                              <CommandList className="max-h-[200px] overflow-y-auto bg-background border border-border">
                                <CommandEmpty className="text-muted-foreground">No exercises found.</CommandEmpty>
                                <CommandGroup className="bg-background">
                                  {exerciseLibrary
                                    .filter(ex => {
                                      const search = (searchValue[exIdx] || exercise.exercise_name || '').toLowerCase()
                                      return search === '' || ex.name.toLowerCase().includes(search)
                                    })
                                    .map((ex) => (
                                      <CommandItem
                                        key={ex.id}
                                        value={ex.name}
                                        onSelect={() => {
                                          const updated = [...newWorkoutExercises]
                                          updated[exIdx] = {
                                            ...updated[exIdx],
                                            exercise_id: ex.id,
                                            exercise_name: ex.name,
                                          }
                                          setNewWorkoutExercises(updated)
                                          setOpenCombobox((prev) => ({ ...prev, [exIdx]: false }))
                                          setSearchValue((prev) => ({ ...prev, [exIdx]: ex.name }))
                                        }}
                                        className="text-foreground hover:bg-muted cursor-pointer bg-background"
                                      >
                                        {ex.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            )}
                          </Command>
                          {exercise.exercise_name && (
                            <p className="text-xs text-muted-foreground mt-1">{exercise.exercise_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = newWorkoutExercises.filter((_, i) => i !== exIdx)
                          setNewWorkoutExercises(updated)
                        }}
                        className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Exercise Notes */}
                    <div className="mb-3">
                      <Input
                        type="text"
                        placeholder="Exercise notes (optional)"
                        value={exercise.notes}
                        onChange={(e) => {
                          const updated = [...newWorkoutExercises]
                          updated[exIdx].notes = e.target.value
                          setNewWorkoutExercises(updated)
                        }}
                        className="bg-card text-foreground border-border text-sm"
                      />
                    </div>

                    {/* Sets */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-muted-foreground">Sets</label>
                        <Button
                          type="button"
                          onClick={() => {
                            const updated = [...newWorkoutExercises]
                            updated[exIdx].sets = [...updated[exIdx].sets, {
                              set_number: updated[exIdx].sets.length + 1,
                              weight: null,
                              reps: null,
                              rir: null,
                              rpe: null,
                              notes: null,
                            }]
                            setNewWorkoutExercises(updated)
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 h-auto cursor-pointer"
                        >
                          <PlusIcon className="h-3 w-3 mr-1" />
                          Add Set
                        </Button>
                      </div>

                      {exercise.sets.length > 0 && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-muted-foreground pb-1 border-b border-border">
                            <div>Set</div>
                            <div>Weight</div>
                            <div>Reps</div>
                            <div>RIR</div>
                            <div>RPE</div>
                            <div>Notes</div>
                            <div></div>
                          </div>
                          {exercise.sets.map((set, setIdx) => (
                            <div key={setIdx} className="grid grid-cols-7 gap-2 items-center">
                              <div className="text-xs text-muted-foreground">{set.set_number}</div>
                              <Input
                                type="text"
                                placeholder="e.g. 8 or 8-12"
                                value={set.weight ?? ''}
                                onChange={(e) => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets[setIdx].weight = e.target.value || null
                                  setNewWorkoutExercises(updated)
                                }}
                                className="bg-card text-foreground border-border text-xs h-8"
                              />
                              <Input
                                type="text"
                                placeholder="e.g. 8 or 8-12"
                                value={set.reps ?? ''}
                                onChange={(e) => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets[setIdx].reps = e.target.value || null
                                  setNewWorkoutExercises(updated)
                                }}
                                className="bg-card text-foreground border-border text-xs h-8"
                              />
                              <Input
                                type="text"
                                placeholder="e.g. 2 or 1-3"
                                value={set.rir ?? ''}
                                onChange={(e) => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets[setIdx].rir = e.target.value || null
                                  setNewWorkoutExercises(updated)
                                }}
                                className="bg-card text-foreground border-border text-xs h-8"
                              />
                              <Input
                                type="text"
                                placeholder="e.g. 7 or 6-8"
                                value={set.rpe ?? ''}
                                onChange={(e) => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets[setIdx].rpe = e.target.value || null
                                  setNewWorkoutExercises(updated)
                                }}
                                className="bg-card text-foreground border-border text-xs h-8"
                              />
                              <Input
                                type="text"
                                placeholder="Notes"
                                value={set.notes ?? ''}
                                onChange={(e) => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets[setIdx].notes = e.target.value || null
                                  setNewWorkoutExercises(updated)
                                }}
                                className="bg-card text-foreground border-border text-xs h-8"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...newWorkoutExercises]
                                  updated[exIdx].sets = updated[exIdx].sets.filter((_, i) => i !== setIdx)
                                  // Renumber sets
                                  updated[exIdx].sets = updated[exIdx].sets.map((s, i) => ({
                                    ...s,
                                    set_number: i + 1,
                                  }))
                                  setNewWorkoutExercises(updated)
                                }}
                                className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!person) return
                    if (!newWorkoutDate) {
                      alert('Please select a workout date')
                      return
                    }
                    if (newWorkoutExercises.length === 0) {
                      alert('Please add at least one exercise')
                      return
                    }
                    if (newWorkoutExercises.some(ex => !ex.exercise_id || ex.exercise_id.trim() === '')) {
                      alert('Please select an exercise for all exercise entries')
                      return
                    }

                    try {
                      // Create workout with workout_date - allow incomplete workouts
                      const newWorkout = await upsertWorkout({
                        person_id: person.id,
                        day_id: null,
                        completed: false, // Allow creating incomplete workouts
                        workout_date: new Date(newWorkoutDate).toISOString(),
                      })

                      // Create exercises and sets
                      for (let i = 0; i < newWorkoutExercises.length; i++) {
                        const exercise = newWorkoutExercises[i]
                        const sessionExercise = await upsertSessionExercise({
                          workout_id: newWorkout.id,
                          exercise_id: exercise.exercise_id,
                          position: i,
                          notes: exercise.notes || null,
                        })

                        if (exercise.sets && exercise.sets.length > 0) {
                          for (const set of exercise.sets) {
                            await upsertExerciseSet({
                              session_exercise_id: sessionExercise.id,
                              set_number: set.set_number,
                              // Convert number inputs to numrange format for database
                              weight: set.weight !== null && set.weight !== undefined ? parseRangeInput(String(set.weight)) : null,
                              reps: set.reps !== null && set.reps !== undefined ? parseRangeInput(String(set.reps)) : null,
                              rir: set.rir !== null && set.rir !== undefined ? parseRangeInput(String(set.rir)) : null,
                              rpe: set.rpe !== null && set.rpe !== undefined ? parseRangeInput(String(set.rpe)) : null,
                              notes: set.notes ?? null,
                            })
                          }
                        }
                      }

                      // Reload workouts
                      const workoutsWithData = await fetchPersonWorkoutsWithData(person.id)
                      setWorkouts(workoutsWithData)
                      
                      // Reset form
                      setNewWorkoutDate(new Date().toISOString().split('T')[0])
                      setNewWorkoutExercises([])
                      setShowAddWorkoutForm(false)
                      setOpenCombobox({})
                      setSearchValue({})
                    } catch (error) {
                      console.error('Error creating workout:', error)
                      alert('Error creating workout. Please try again.')
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                >
                  Save Workout
                </Button>
                <Button
                  onClick={() => {
                    setShowAddWorkoutForm(false)
                    setNewWorkoutDate(new Date().toISOString().split('T')[0])
                    setNewWorkoutExercises([])
                    setOpenCombobox({})
                    setSearchValue({})
                  }}
                  variant="outline"
                  className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* View Content */}
          {workoutView === 'calendar' ? (
            <WorkoutCalendar
              workouts={workouts}
              onWorkoutUpdate={async () => {
                if (person) {
                  const workoutsWithData = await fetchPersonWorkoutsWithData(person.id)
                  setWorkouts(workoutsWithData)
                }
              }}
              onWorkoutClick={(workout) => setEditingWorkoutId(workout.id)}
              onDateClick={(date) => {
                // When a date is clicked in calendar, open assign dialog with that date
                setAssignProgramWorkoutDate(date.toISOString().split('T')[0])
                setAssignProgramWorkoutOpen(true)
              }}
            />
          ) : (
            <>
              {workouts.length === 0 && !showAddWorkoutForm ? (
                <p className="text-muted-foreground">No workouts found.</p>
              ) : (
                <div className="space-y-4">
                  {workouts
                    .sort((a, b) => {
                      // Sort by workout_date (most recent first), fallback to created_at
                      const dateA = a.workout_date ? new Date(a.workout_date).getTime() : new Date(a.created_at).getTime()
                      const dateB = b.workout_date ? new Date(b.workout_date).getTime() : new Date(b.created_at).getTime()
                      return dateB - dateA
                    })
                    .map((workout) => (
                    <div
                      key={workout.id}
                      className={`bg-background border rounded-lg p-4 ${
                        workout.completed 
                          ? 'border-border' 
                          : 'border-orange-500/50 bg-orange-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              Workout
                            </h3>
                            {!workout.completed && (
                              <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs rounded border border-orange-600/50">
                                Incomplete
                              </span>
                            )}
                            {workout.completed && (
                              <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded border border-green-600/50">
                                Completed
                              </span>
                            )}
                            {workout.session && (
                              <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-600/50">
                                From Session: {workout.session.type}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">Date:</span>{' '}
                            {workout.workout_date 
                              ? new Date(workout.workout_date).toLocaleString()
                              : new Date(workout.created_at).toLocaleString()}
                          </p>
                          {workout.session && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-semibold text-foreground">Session Date:</span>{' '}
                              {workout.session.start_time
                                ? new Date(workout.session.start_time).toLocaleString()
                                : 'N/A'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!workout.completed && (
                            <button
                              onClick={async () => {
                                try {
                                  await updateWorkout(workout.id, { completed: true })
                                  if (person) {
                                    const workoutsWithData = await fetchPersonWorkoutsWithData(person.id)
                                    setWorkouts(workoutsWithData)
                                  }
                                } catch (err) {
                                  console.error('Error completing workout:', err)
                                  alert('Error completing workout. Please try again.')
                                }
                              }}
                              className="p-2 text-green-500 hover:text-green-600 cursor-pointer"
                              title="Mark as completed"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditingWorkoutId(workout.id)}
                            className="p-2 text-orange-500 hover:text-orange-600 cursor-pointer"
                            title="Edit workout"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                  {workout.exercises && workout.exercises.length > 0 ? (
                    <div className="space-y-3 mt-4">
                      {workout.exercises.map((exercise, idx) => (
                        <div
                          key={exercise.id || idx}
                          className="bg-muted rounded-md p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-md font-medium text-foreground">
                              {exercise.position + 1}. {exercise.exercise_name || 'Unknown Exercise'}
                            </h4>
                            {exercise.notes && (
                              <p className="text-xs text-muted-foreground">{exercise.notes}</p>
                            )}
                          </div>
                          {exercise.sets && exercise.sets.length > 0 && (
                            <div className="space-y-1">
                              <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-muted-foreground pb-1 border-b border-border">
                                <div>Set</div>
                                <div>Weight</div>
                                <div>Reps</div>
                                <div>RIR</div>
                                <div>RPE</div>
                                <div>Notes</div>
                              </div>
                              {exercise.sets.map((set, setIdx) => (
                                <div
                                  key={set.id || setIdx}
                                  className="grid grid-cols-6 gap-2 text-xs text-muted-foreground"
                                >
                                  <div>{set.set_number}</div>
                                  <div>{set.weight ? formatRangeDisplay(set.weight) ?? '-' : '-'}</div>
                                  <div>{set.reps ? formatRangeDisplay(set.reps) ?? '-' : '-'}</div>
                                  <div>{set.rir ? formatRangeDisplay(set.rir) ?? '-' : '-'}</div>
                                  <div>{set.rpe ? formatRangeDisplay(set.rpe) ?? '-' : '-'}</div>
                                  <div className="text-xs truncate">{set.notes || '-'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm mt-4">No exercises recorded for this workout.</p>
                  )}
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="p-4 bg-card border border-border rounded-md space-y-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Progress</h2>
          {/* Convert workouts to SessionWithExercises format for charts - use workout data primarily */}
          <WorkoutVolumeChart sessions={workouts
            .filter(w => {
              // Only include completed workouts with exercises and a workout_date
              return w.completed && w.exercises && w.exercises.length > 0 && w.workout_date
            })
            .map(w => ({
              // Use session data if available, otherwise create a session-like object from workout
              id: w.session?.id || w.id,
              person_id: w.person_id,
              trainer_id: w.session?.trainer_id || null,
              type: w.session?.type || 'Client Session' as any,
              workout_id: w.id,
              person_package_id: w.session?.person_package_id || null,
              start_time: w.session?.start_time || null,
              // Use workout_date as the primary date (never fall back to created_at)
              started_at: w.workout_date!,
              end_time: w.session?.end_time || null,
              created_at: w.created_at,
              converted: w.session?.converted || false,
              status: w.session?.status || 'completed' as any,
              exercises: w.exercises || [],
            })) as SessionWithExercises[]} />
          <RPERIRChart sessions={workouts
            .filter(w => {
              // Only include completed workouts with exercises and a workout_date
              return w.completed && w.exercises && w.exercises.length > 0 && w.workout_date
            })
            .map(w => ({
              id: w.session?.id || w.id,
              person_id: w.person_id,
              trainer_id: w.session?.trainer_id || null,
              type: w.session?.type || 'Client Session' as any,
              workout_id: w.id,
              person_package_id: w.session?.person_package_id || null,
              start_time: w.session?.start_time || null,
              // Use workout_date as the primary date (never fall back to created_at)
              started_at: w.workout_date!,
              end_time: w.session?.end_time || null,
              created_at: w.created_at,
              converted: w.session?.converted || false,
              status: w.session?.status || 'completed' as any,
              exercises: w.exercises || [],
            })) as SessionWithExercises[]} />
          <WeightProgressionChart sessions={workouts
            .filter(w => {
              // Only include completed workouts with exercises and a workout_date
              return w.completed && w.exercises && w.exercises.length > 0 && w.workout_date
            })
            .map(w => ({
              id: w.session?.id || w.id,
              person_id: w.person_id,
              trainer_id: w.session?.trainer_id || null,
              type: w.session?.type || 'Client Session' as any,
              workout_id: w.id,
              person_package_id: w.session?.person_package_id || null,
              start_time: w.session?.start_time || null,
              // Use workout_date as the primary date (never fall back to created_at)
              started_at: w.workout_date!,
              end_time: w.session?.end_time || null,
              created_at: w.created_at,
              converted: w.session?.converted || false,
              status: w.session?.status || 'completed' as any,
              exercises: w.exercises || [],
            })) as SessionWithExercises[]} />
        </div>
      )}

      {activeTab === 'packages' && isClient && (
        <>
          {packagesLoading ? (
            <div className="p-4 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Loading packages data...</p>
            </div>
          ) : (
            <Packages personPackages={personPackages || []} packages={packages || []} />
          )}
        </>
      )}

      {activeTab === 'payments' && isClient && person && (
        <>
          {paymentsLoading ? (
            <div className="p-4 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Loading payments data...</p>
            </div>
          ) : (
            <Payments 
              payments={payments || []} 
              personPackages={personPackages || []} 
              packages={packages || []}
              personId={person.id}
              onPaymentAdded={handleRefreshPayments}
            />
          )}
        </>
      )}

      {activeTab === 'contracts' && isClient && (
        <>
          {contractsLoading ? (
            <div className="p-4 bg-card border border-border rounded-md">
              <p className="text-muted-foreground">Loading contracts data...</p>
            </div>
          ) : (
            <Contracts contracts={contracts || []} packages={packages || []} />
          )}
        </>
      )}

      {/* Edit Workout Overlay - Full screen except sidebar */}
      {editingWorkoutId && editingWorkoutId !== 'new' && (() => {
        const workoutToEdit = workouts.find(w => w.id === editingWorkoutId)
        
        return (
          <div className="fixed inset-0 bg-background z-50 overflow-y-auto overflow-x-hidden" style={{ marginLeft: '256px' }}>
            <div className="max-w-4xl mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Edit Workout</h2>
                <button
                  onClick={() => setEditingWorkoutId(null)}
                  className="p-2 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
          <EditWorkout
                open={!!editingWorkoutId}
            onOpenChange={(open) => {
                  if (!open) setEditingWorkoutId(null)
            }}
                sessionId={workoutToEdit?.session?.id}
                initialExercises={workoutToEdit?.exercises}
                sessionStatus={workoutToEdit?.session?.status}
            mode="edit"
                hideDialog={true}
            onSave={async (data) => {
              try {
                if (!person) {
                  throw new Error('Person not found')
                }

                // Update existing workout
                if (!workoutToEdit) {
                  throw new Error('Workout not found')
                }
                const workoutId = workoutToEdit.id

                // Filter out exercises without valid exercise_id
                const validExercises = data.exercises.filter(ex => ex.exercise_id && ex.exercise_id.trim() !== '')
                
                if (validExercises.length === 0) {
                  alert('Please select at least one exercise before saving.')
                  throw new Error('No valid exercises to save')
                }

                if (validExercises.length !== data.exercises.length) {
                  alert(`Warning: ${data.exercises.length - validExercises.length} exercise(s) without a selected exercise were skipped.`)
                }

                // Use smart update function to handle exercises intelligently
                const exerciseData = validExercises.map((ex, index) => ({
                  exercise_id: ex.exercise_id,
                  position: index,
                  notes: ex.notes || null,
                }))

                // Upsert exercises using smart update (compares and updates/inserts/deletes as needed)
                const updatedExercises = await upsertWorkoutExercises(workoutId, exerciseData)

                // Now update sets for each exercise using smart update
                for (let i = 0; i < validExercises.length; i++) {
                  const exercise = validExercises[i]
                  const updatedExercise = updatedExercises[i]
                  
                  if (updatedExercise && updatedExercise.id) {
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

                // Reload workouts efficiently
                const workoutsWithData = await fetchPersonWorkoutsWithData(person.id)
                setWorkouts(workoutsWithData)
                setEditingWorkoutId(null)
              } catch (error) {
                console.error('Error saving workout:', error)
                alert('Error saving workout. Please try again.')
                throw error
              }
            }}
          />
            </div>
          </div>
        )
      })()}

      {/* Assign Program Workout Dialog */}
      {person && (
        <AssignProgramWorkout
          open={assignProgramWorkoutOpen}
          onOpenChange={setAssignProgramWorkoutOpen}
          personId={person.id}
          initialDate={assignProgramWorkoutDate}
          onWorkoutAssigned={async () => {
            if (person) {
              const workoutsWithData = await fetchPersonWorkoutsWithData(person.id)
              setWorkouts(workoutsWithData)
            }
          }}
        />
      )}

      {/* Assign Meal Dialog */}
      {person && (
        <Dialog open={assignMealOpen} onOpenChange={setAssignMealOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Meal</DialogTitle>
              <DialogDescription>
                Select a meal from your nutrition programs to assign to this client.
              </DialogDescription>
            </DialogHeader>
            <AssignMealDialogContent
              personId={person.id}
              initialDate={assignMealDate}
              onMealAssigned={async () => {
                if (person) {
                  const meals = await fetchAssignedMeals(person.id)
                  setAssignedMeals(meals)
                }
                setAssignMealOpen(false)
              }}
              onCancel={() => setAssignMealOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

