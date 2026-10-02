'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { formatRangeDisplay } from '@/supabase/utils/rangeparse'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { useTheme } from '@/context/themecontext'

type WeightProgressionChartProps = {
  sessions: SessionWithExercises[]
}

type ExerciseDataPoint = {
  date: string
  formattedDate: string
  timestamp: number
  [exerciseName: string]: string | number // Dynamic keys for each exercise
}

const DEFAULT_EXERCISES = ['Squat', 'Bench Press', 'Deadlift']

export default function WeightProgressionChart({ sessions }: WeightProgressionChartProps) {
  const { variables } = useTheme()
  const [selectedExercises, setSelectedExercises] = useState<string[]>(DEFAULT_EXERCISES)
  const [daysView, setDaysView] = useState<30 | 60 | 90>(90)
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  // Load exercise library
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const exercises = await fetchExercises()
        setExerciseLibrary(exercises)
      } catch (err) {
        console.error('Failed to fetch exercises:', err)
      }
    }
    loadExercises()
  }, [])

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchValue.trim()) return []
    const searchLower = searchValue.toLowerCase()
    return exerciseLibrary
      .filter((ex) => ex.name.toLowerCase().includes(searchLower))
      .slice(0, 10) // Limit to 10 results
  }, [exerciseLibrary, searchValue])

  const addExercise = (exerciseName: string) => {
    if (!selectedExercises.includes(exerciseName)) {
      setSelectedExercises([...selectedExercises, exerciseName])
    }
    setSearchValue('')
    setSearchOpen(false)
  }

  const removeExercise = (exerciseName: string) => {
    setSelectedExercises(selectedExercises.filter((name) => name !== exerciseName))
  }

  // Process data for weight progression
  const chartData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysView)

      // Filter sessions within the time period
      // Use started_at which should contain workout_date from the workout
      const relevantSessions = sessions.filter((session) => {
        // started_at should contain workout_date from the workout mapping
        if (!session.started_at) return false
        const sessionDate = new Date(session.started_at)
        if (isNaN(sessionDate.getTime())) return false
        return sessionDate >= cutoffDate && sessionDate <= now
      })

      // For each selected exercise, find max weight per day
      const exerciseDataByDate = new Map<string, Map<string, number>>()

      for (const session of relevantSessions) {
        if (!session.exercises) continue
        // started_at contains workout_date from the workout
        if (!session.started_at) continue
        const sessionDate = new Date(session.started_at)
        if (isNaN(sessionDate.getTime())) continue
        const dateKey = sessionDate.toISOString().split('T')[0]

      for (const exercise of session.exercises) {
        const exerciseName = exercise.exercise_name || ''
        
        // Check if this exercise matches any selected exercise (case-insensitive)
        const matchingExercise = selectedExercises.find(
          (selected) => exerciseName.toLowerCase().includes(selected.toLowerCase()) ||
                       selected.toLowerCase().includes(exerciseName.toLowerCase())
        )

        if (matchingExercise && exercise.sets && exercise.sets.length > 0) {
          // Extract number from numrange string (for completed workouts, should be [x,x] format)
          const extractNumberFromRange = (rangeStr: string | null | undefined): number => {
            if (!rangeStr) return 0
            
            const formatted = formatRangeDisplay(rangeStr)
            if (!formatted) return 0
            
            // If it's a single number (no dash), use that
            if (!formatted.includes('-')) {
              const num = parseFloat(formatted)
              return isNaN(num) ? 0 : num
            }
            
            // If it's a range like "100-120", use the upper bound for max weight
            const parts = formatted.split('-')
            const upper = parseFloat(parts[1]?.trim() || parts[0]?.trim() || '0')
            return isNaN(upper) ? 0 : upper
          }
          
          // Find max weight for this exercise in this session
          let maxWeight = 0
          for (const set of exercise.sets) {
            const weight = extractNumberFromRange(set.weight)
            if (weight > maxWeight) {
              maxWeight = weight
            }
          }

          if (maxWeight > 0) {
            if (!exerciseDataByDate.has(dateKey)) {
              exerciseDataByDate.set(dateKey, new Map())
            }
            const exerciseMap = exerciseDataByDate.get(dateKey)!
            const currentMax = exerciseMap.get(matchingExercise) || 0
            if (maxWeight > currentMax) {
              exerciseMap.set(matchingExercise, maxWeight)
            }
          }
        }
      }
    }

    // Convert to chart data format
    const dataPoints: ExerciseDataPoint[] = Array.from(exerciseDataByDate.entries())
      .map(([date, exerciseMap]) => {
        const dateObj = new Date(date)
        const point: ExerciseDataPoint = {
          date,
          formattedDate: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          timestamp: dateObj.getTime(),
        }

        // Add weight for each selected exercise (only if data exists)
        let hasData = false
        for (const exerciseName of selectedExercises) {
          const weight = exerciseMap.get(exerciseName)
          if (weight && weight > 0) {
            point[exerciseName] = weight
            hasData = true
          }
          // Don't add the key at all if there's no data - Recharts will handle undefined
        }

        // Only include points that have at least one exercise with data
        return hasData ? point : null
      })
      .filter((point): point is ExerciseDataPoint => point !== null)
      .sort((a, b) => a.timestamp - b.timestamp)

    return dataPoints
  }, [sessions, daysView, selectedExercises])

  // Generate colors for each exercise
  const exerciseColors = [
    '#f97316', // Orange
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#ec4899', // Pink
  ]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* View Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setDaysView(30)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              daysView === 30
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            } cursor-pointer`}
          >
            30 Days
          </button>
          <button
            onClick={() => setDaysView(60)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              daysView === 60
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            } cursor-pointer`}
          >
            60 Days
          </button>
          <button
            onClick={() => setDaysView(90)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              daysView === 90
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            } cursor-pointer`}
          >
            90 Days
          </button>
        </div>

        {/* Exercise Search */}
        <div className="relative">
          <Command className="bg-card border border-border rounded-lg">
            <CommandInput
              placeholder="Search exercises..."
              value={searchValue}
              onValueChange={setSearchValue}
              onFocus={() => setSearchOpen(true)}
              className="text-foreground"
            />
            {searchOpen && filteredExercises.length > 0 && (
              <CommandList className="max-h-48">
                <CommandEmpty>No exercises found.</CommandEmpty>
                <CommandGroup>
                  {filteredExercises.map((exercise) => (
                    <CommandItem
                      key={exercise.id}
                      value={exercise.name}
                      onSelect={() => addExercise(exercise.name)}
                      className="text-foreground hover:bg-muted cursor-pointer"
                    >
                      {exercise.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
        </div>
      </div>

      {/* Selected Exercises Tags */}
      <div className="flex flex-wrap gap-2">
        {selectedExercises.map((exerciseName, index) => (
          <div
            key={exerciseName}
            className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-md"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: exerciseColors[index % exerciseColors.length] }}
            />
            <span className="text-sm text-secondary-foreground">{exerciseName}</span>
            <button
              onClick={() => removeExercise(exerciseName)}
              className="text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Weight Progression</h3>
        {chartData.length === 0 || selectedExercises.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No weight data available for the selected exercises and period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={variables.border} />
              <XAxis
                dataKey="formattedDate"
                stroke={variables.mutedForeground}
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke={variables.mutedForeground}
                style={{ fontSize: '12px' }}
                label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft', style: { fill: variables.mutedForeground } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: variables.card,
                  border: `1px solid ${variables.border}`,
                  borderRadius: '6px',
                  color: variables.foreground,
                }}
                formatter={(value: number | undefined) => {
                  if (value === null || value === undefined || value === 0) {
                    return null // Don't show tooltip for missing values
                  }
                  return [`${value.toFixed(1)} lbs`, '']
                }}
                labelStyle={{ color: variables.foreground }}
              />
              <Legend
                wrapperStyle={{ color: variables.foreground, paddingTop: '20px' }}
              />
              {selectedExercises.map((exerciseName, index) => (
                <Line
                  key={exerciseName}
                  type="monotone"
                  dataKey={exerciseName}
                  stroke={exerciseColors[index % exerciseColors.length]}
                  strokeWidth={2}
                  dot={(props: any) => {
                    // Only show dot if value exists and is greater than 0
                    const value = props.payload?.[exerciseName]
                    if (value && value > 0) {
                      return <circle cx={props.cx} cy={props.cy} r={4} fill={exerciseColors[index % exerciseColors.length]} />
                    }
                    return null
                  }}
                  activeDot={{ r: 6 }}
                  name={exerciseName}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

