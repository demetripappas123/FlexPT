import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/supabase/supabaseClient'
import { PROGRAM_BUILDER_SYSTEM_PROMPT } from '@/openai/prompts/programbuilder'
import { fetchWeeksServer } from '@/supabase/fetches/server/fetchweek'
import { fetchDayExercisesServer } from '@/supabase/fetches/server/fetchdayexercises'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { deleteWeek } from '@/supabase/deletions/deleteweek'
import { deleteDay } from '@/supabase/deletions/deleteday'
import { deleteDayExercises } from '@/supabase/deletions/deletedayexercises'
import { addDay } from '@/supabase/upserts/upsertday'
import { upsertDayExercises, updateDayExercises, DayExercise } from '@/supabase/upserts/upsertexercises'
import { parseRangeInput } from '@/supabase/utils/rangeparse'
import { getOrCreateConversation, updateConversation } from '@/supabase/helpers/aiconversation'

/**
 * Safely converts a value to numrange format
 * Handles both user input (e.g., "8-12", "8") and existing numrange format (e.g., "[8,12]")
 */
function toNumRange(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null
  
  const trimmed = value.trim()
  
  // If already in numrange format (starts with [ or (), use it directly
  if (trimmed.startsWith('[') || trimmed.startsWith('(')) {
    return trimmed
  }
  
  // Otherwise, parse as user input
  return parseRangeInput(trimmed)
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_MASTER_KEY! })

/* ───────────────────────────────────────────── */
/* TYPES                                         */
/* ───────────────────────────────────────────── */

type Operation =
  | { op: 'delete'; target: 'week'; week_number: number }
  | { op: 'add'; target: 'week'; week_number: number }
  | { op: 'delete'; target: 'day'; week_number: number; day_name: string }
  | { op: 'add'; target: 'day'; week_number: number; day_name: string }
  | {
      op: 'add' | 'edit' | 'delete' | 'reorder'
      target: 'exercise'
      week_number: number
      day_name: string
      exercise_name: string
      sets?: string
      reps?: string
      rir?: string | null
      rpe?: string | null
      notes?: string
      order?: number
    }

type AIResponse =
  | { type: 'question'; message: string }
  | { type: 'program'; message: string; operations: Operation[] }

/* ───────────────────────────────────────────── */
/* CONTEXT FETCHING                               */
/* ───────────────────────────────────────────── */

/**
 * Fetch program state as JSON for AI context
 * Optimized with parallel queries
 */
async function fetchProgramStateForAI(programId: string | null, trainerId: string): Promise<any> {
  if (!programId) {
    return null
  }

  try {
    // Fetch weeks with days in parallel
    const weeks = await fetchWeeksServer(programId, trainerId)
    
    if (!weeks || weeks.length === 0) {
      return null
    }

    // Fetch exercises for all days in parallel
    const allDayIds = weeks.flatMap(week => week.days.map(day => day.id))
    
    if (allDayIds.length === 0) {
      return {
        weeks: weeks.map(week => ({
          number: week.number,
          days: week.days.map(day => ({
            name: day.name,
            exercises: [],
          })),
        })),
      }
    }

    // Fetch all exercises in parallel using Promise.all
    const exercisePromises = allDayIds.map(dayId => fetchDayExercisesServer(dayId))
    const exerciseArrays = await Promise.all(exercisePromises)
    
    // Create a map of day_id -> exercises
    const exercisesByDayId = new Map<string, typeof exerciseArrays[0]>()
    allDayIds.forEach((dayId, index) => {
      exercisesByDayId.set(dayId, exerciseArrays[index])
    })

    // Build program state structure
    return {
      weeks: weeks.map(week => ({
        number: week.number,
        days: week.days.map(day => {
          const exercises = exercisesByDayId.get(day.id) || []
          return {
            name: day.name,
            exercises: exercises.map(ex => ({
              exercise_name: ex.exercise_name,
              sets: ex.sets,
              reps: ex.reps,
              rir: ex.rir,
              rpe: ex.rpe,
              notes: ex.notes,
            })),
          }
        }),
      })),
    }
  } catch (error) {
    console.error('Error fetching program state for AI:', error)
    return null
  }
}

/**
 * Build enhanced system prompt with context
 */
function buildEnhancedSystemPrompt(
  programState: any,
  exerciseLibrary: Array<{ id: string; name: string }>,
  conversationSummary: string | null
): string {
  let enhancedPrompt = PROGRAM_BUILDER_SYSTEM_PROMPT

  // Add exercise library
  const exerciseList = exerciseLibrary.map(ex => `- ${ex.name} (ID: ${ex.id})`).join('\n')
  enhancedPrompt = `${enhancedPrompt}

AVAILABLE EXERCISES IN LIBRARY:
${exerciseList}

IMPORTANT: When specifying exercises in your program JSON, use the EXACT exercise name as shown above (case-sensitive).`

  // Add program state if available
  if (programState) {
    const programStateJson = JSON.stringify(programState, null, 2)
    enhancedPrompt = `${enhancedPrompt}

CURRENT PROGRAM STATE:
${programStateJson}

Use the current program state above to understand what already exists in the program. When modifying or creating program content, take into account the existing structure.`
  }

  // Add conversation summary if available
  if (conversationSummary && conversationSummary.trim()) {
    enhancedPrompt = `${enhancedPrompt}

CONVERSATION SUMMARY:
${conversationSummary}

This summary contains the context from our previous interactions. Use this to remember user preferences, goals, previous decisions, and conversation history.`
  }

  return enhancedPrompt
}

/* ───────────────────────────────────────────── */
/* CORE APPLY LOGIC                              */
/* ───────────────────────────────────────────── */

/**
 * Normalizes exercise_numbers for a day to remove gaps and ensure sequential ordering
 * Uses batch update for efficiency
 */
async function normalizeExerciseNumbers(dayId: string): Promise<void> {
  const exercises = await fetchDayExercisesServer(dayId)
  
  // Sort by current exercise_number (nulls last) or by exercise_def_id as fallback
  exercises.sort((a, b) => {
    const aNum = a.exercise_number ?? Infinity
    const bNum = b.exercise_number ?? Infinity
    if (aNum !== bNum) return aNum - bNum
    return a.exercise_def_id.localeCompare(b.exercise_def_id)
  })

  // Batch update all exercise_numbers that need to change
  const updates = exercises
    .map((ex, index) => {
      const newNumber = index + 1
      if (ex.exercise_number !== newNumber) {
        return { exercise_def_id: ex.exercise_def_id, exercise_number: newNumber }
      }
      return null
    })
    .filter((update): update is { exercise_def_id: string; exercise_number: number } => update !== null)

  if (updates.length === 0) return

  // Use RPC or batch update approach
  // Since Supabase doesn't have native batch update, we'll use Promise.all for parallel updates
  // This is still much faster than sequential
  const updatePromises = updates.map(update =>
    supabase
      .from('program_exercises')
      .update({ exercise_number: update.exercise_number })
      .eq('day_id', dayId)
      .eq('exercise_def_id', update.exercise_def_id)
  )

  const results = await Promise.all(updatePromises)
  
  // Check for errors
  for (const result of results) {
    if (result.error) {
      console.error('normalizeExerciseNumbers batch update error:', result.error)
    }
  }
}

/**
 * Batch normalizes exercise_numbers for multiple days in parallel
 */
async function batchNormalizeExerciseNumbers(dayIds: string[]): Promise<void> {
  if (dayIds.length === 0) return
  
  // Normalize all days in parallel
  await Promise.all(dayIds.map(dayId => normalizeExerciseNumbers(dayId)))
}

async function applyOperations(
  trainerId: string,
  programId: string,
  operations: Operation[],
  exerciseLibrary: { id: string; name: string }[]
) {
  const weeks = await fetchWeeksServer(programId, trainerId)

  // Cache structure: weekByNumber -> dayByName -> exercises array
  const weekByNumber = new Map(weeks.map(w => [w.number, w]))
  
  // Cache exercises per day to avoid stale fetches
  const exercisesCache = new Map<string, Awaited<ReturnType<typeof fetchDayExercisesServer>>>()
  
  // Track which days have been modified (need normalization at the end)
  const modifiedDays = new Set<string>()
  
  // Helper to get exercises for a day (from cache or fetch)
  const getExercisesForDay = async (dayId: string) => {
    if (!exercisesCache.has(dayId)) {
      exercisesCache.set(dayId, await fetchDayExercisesServer(dayId))
    }
    return exercisesCache.get(dayId)!
  }
  
  // Helper to invalidate exercise cache for a day and mark as modified
  const invalidateDayCache = (dayId: string) => {
    exercisesCache.delete(dayId)
    modifiedDays.add(dayId)
  }
  
  // Helper to update cache in-memory after mutation (avoids refetch)
  const updateCacheAfterMutation = async (dayId: string) => {
    modifiedDays.add(dayId)
    // Don't refetch immediately - we'll do batch normalization at the end
    // But invalidate so we know it's stale if accessed again
    exercisesCache.delete(dayId)
  }

  for (const op of operations) {
    /* ───── WEEK ───── */
    if (op.target === 'week') {
      if (op.op === 'delete') {
        const week = weekByNumber.get(op.week_number)
        if (week) {
          // Invalidate all exercise caches for days in this week
          week.days?.forEach(day => invalidateDayCache(day.id))
          await deleteWeek(week.id)
          weekByNumber.delete(op.week_number) // Remove from cache
        }
      }

      if (op.op === 'add') {
        const { data: newWeek, error } = await supabase
          .from('program_weeks')
          .insert({
            program_id: programId,
            number: op.week_number,
            trainer_id: trainerId,
          })
          .select()
          .single()
        
        if (!error && newWeek) {
          weekByNumber.set(op.week_number, {
            id: newWeek.id,
            program_id: newWeek.program_id,
            number: newWeek.number,
            days: [],
          })
        }
      }
    }

    /* ───── DAY ───── */
    if (op.target === 'day') {
      const week = weekByNumber.get(op.week_number)
      if (!week) continue

      const day = week.days?.find(d => d.name === op.day_name)

      if (op.op === 'delete' && day) {
        invalidateDayCache(day.id)
        await deleteDay(day.id)
        // Remove from week.days array
        if (week.days) {
          week.days = week.days.filter(d => d.id !== day.id)
        }
      }

      if (op.op === 'add') {
        const newDay = await addDay(week.id, op.day_name)
        if (newDay) {
          if (!week.days) week.days = []
          week.days.push({
            id: newDay.id,
            name: newDay.name,
          })
          // Initialize empty cache for new day
          exercisesCache.set(newDay.id, [])
        }
      }
    }

    /* ───── EXERCISE ───── */
    if (op.target === 'exercise') {
      const week = weekByNumber.get(op.week_number)
      if (!week) continue

      const day = week.days?.find(d => d.name === op.day_name)
      if (!day) continue

      // Use cache-aware fetch
      const existing = await getExercisesForDay(day.id)
      const match = existing.find(
        e => e.exercise_name.toLowerCase() === op.exercise_name.toLowerCase()
      )

      const def = exerciseLibrary.find(
        e => e.name.toLowerCase() === op.exercise_name.toLowerCase()
      )
      if (!def) continue

      if (op.op === 'delete' && match) {
        await deleteDayExercises(day.id, [match.exercise_def_id])
        // Update cache in-memory: remove the deleted exercise
        const cached = exercisesCache.get(day.id)
        if (cached) {
          exercisesCache.set(
            day.id,
            cached.filter(e => e.exercise_def_id !== match.exercise_def_id)
          )
        }
        modifiedDays.add(day.id) // Mark for batch normalization
      }

      if (op.op === 'edit' && match) {
        const exerciseUpdate: DayExercise = {
          day_id: day.id,
          exercise_def_id: def.id,
          sets: op.sets !== undefined ? toNumRange(op.sets) : match.sets,
          reps: op.reps !== undefined ? toNumRange(op.reps) : match.reps,
          rir: op.rir !== undefined ? toNumRange(op.rir ?? null) : match.rir,
          rpe: op.rpe !== undefined ? toNumRange(op.rpe ?? null) : match.rpe,
          notes: op.notes !== undefined ? op.notes : (match.notes ?? ''),
          exercise_number: op.order !== undefined ? op.order : (match.exercise_number ?? null),
        }
        await updateDayExercises(day.id, [exerciseUpdate])
        // Update cache in-memory
        const cached = exercisesCache.get(day.id)
        if (cached) {
          const index = cached.findIndex(e => e.exercise_def_id === def.id)
          if (index !== -1) {
            cached[index] = {
              ...cached[index],
              sets: exerciseUpdate.sets,
              reps: exerciseUpdate.reps,
              rir: exerciseUpdate.rir,
              rpe: exerciseUpdate.rpe,
              notes: exerciseUpdate.notes,
              exercise_number: exerciseUpdate.exercise_number ?? null,
            }
          }
        }
        modifiedDays.add(day.id) // Mark for batch normalization if order changed
      }

      if (op.op === 'add') {
        if (!op.sets || !op.reps) {
          console.warn(`Exercise "${op.exercise_name}" missing required fields (sets/reps)`)
          continue
        }
        
        const newExercise: DayExercise = {
          day_id: day.id,
          exercise_def_id: def.id,
          sets: toNumRange(op.sets),
          reps: toNumRange(op.reps),
          rir: toNumRange(op.rir ?? null),
          rpe: toNumRange(op.rpe ?? null),
          notes: op.notes ?? '',
          exercise_number: op.order !== undefined ? op.order : null,
        }
        await upsertDayExercises([newExercise])
        // Update cache in-memory: add the new exercise
        const cached = exercisesCache.get(day.id) || []
        cached.push({
          day_id: day.id,
          exercise_def_id: def.id,
          exercise_name: def.name,
          sets: newExercise.sets,
          reps: newExercise.reps,
          rir: newExercise.rir,
          rpe: newExercise.rpe,
          notes: newExercise.notes,
          weight_used: null,
          exercise_number: newExercise.exercise_number ?? null,
        })
        exercisesCache.set(day.id, cached)
        modifiedDays.add(day.id) // Mark for batch normalization
      }

      if (op.op === 'reorder' && match && op.order !== undefined) {
        const exerciseUpdate: DayExercise = {
          day_id: day.id,
          exercise_def_id: match.exercise_def_id,
          sets: match.sets,
          reps: match.reps,
          rir: match.rir,
          rpe: match.rpe,
          notes: match.notes ?? '',
          exercise_number: op.order,
        }
        await updateDayExercises(day.id, [exerciseUpdate])
        // Update cache in-memory
        const cached = exercisesCache.get(day.id)
        if (cached) {
          const index = cached.findIndex(e => e.exercise_def_id === match.exercise_def_id)
          if (index !== -1) {
            cached[index] = {
              ...cached[index],
              exercise_number: op.order,
            }
          }
        }
        modifiedDays.add(day.id) // Mark for batch normalization
      }
    }
  }
  
  // Batch normalize all modified days in parallel at the end
  if (modifiedDays.size > 0) {
    await batchNormalizeExerciseNumbers(Array.from(modifiedDays))
  }
}

/* ───────────────────────────────────────────── */
/* ROUTE                                        */
/* ───────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { programId, trainerId, message } = await req.json()
  if (!trainerId || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Fetch context in parallel for optimal speed
  const [exerciseLibrary, programState, conversation] = await Promise.all([
    fetchExercises(),
    programId ? fetchProgramStateForAI(programId, trainerId) : Promise.resolve(null),
    programId ? getOrCreateConversation(trainerId, programId, null, PROGRAM_BUILDER_SYSTEM_PROMPT).catch(() => null) : Promise.resolve(null),
  ])

  // Build enhanced system prompt with context
  const conversationSummary = conversation?.summary || null
  const enhancedSystemPrompt = buildEnhancedSystemPrompt(programState, exerciseLibrary, conversationSummary)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: message },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'No AI response' }, { status: 500 })
  }

  const parsed = JSON.parse(content) as AIResponse

  if (parsed.type === 'question') {
    return NextResponse.json(parsed)
  }

  if (!programId) {
    return NextResponse.json(
      { error: 'Program ID required for edits' },
      { status: 400 }
    )
  }

  await applyOperations(trainerId, programId, parsed.operations, exerciseLibrary)

  // Update conversation with latest messages (optional - non-blocking)
  if (conversation && parsed.type === 'program') {
    // Update conversation state asynchronously (don't block response)
    updateConversation(conversation.id, {
      last_user_message: message,
      last_ai_message: parsed.message,
    }).catch(err => console.error('Error updating conversation:', err))
  }

  return NextResponse.json({
    type: 'program',
    message: parsed.message,
    programId,
  })
}
