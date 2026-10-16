'use client'

import React, { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
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
  [exerciseName: string]: string | number | null
}

const DEFAULT_EXERCISES = ['Squat', 'Bench Press', 'Deadlift']

const EXERCISE_COLORS = [
  '#26251e',
  '#f54e00',
  '#1f8a65',
  '#c08532',
  '#9fbbe0',
  '#c0a8dd',
  '#9fc9a2',
  '#dfa88f',
]

export default function WeightProgressionChart({ sessions }: WeightProgressionChartProps) {
  const { variables } = useTheme()
  const [selectedExercises, setSelectedExercises] = useState<string[]>(DEFAULT_EXERCISES)
  const [daysView, setDaysView] = useState<30 | 60 | 90>(90)
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

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

  const filteredExercises = useMemo(() => {
    if (!searchValue.trim()) return []
    const searchLower = searchValue.toLowerCase()
    return exerciseLibrary
      .filter((ex) => ex.name.toLowerCase().includes(searchLower))
      .slice(0, 10)
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

  const chartData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysView)

    const relevantSessions = sessions.filter((session) => {
      if (!session.started_at) return false
      const sessionDate = new Date(session.started_at)
      if (isNaN(sessionDate.getTime())) return false
      return sessionDate >= cutoffDate && sessionDate <= now
    })

    const exerciseDataByDate = new Map<string, Map<string, number>>()

    for (const session of relevantSessions) {
      if (!session.exercises) continue
      if (!session.started_at) continue
      const sessionDate = new Date(session.started_at)
      if (isNaN(sessionDate.getTime())) continue
      const dateKey = sessionDate.toISOString().split('T')[0]

      for (const exercise of session.exercises) {
        const exerciseName = exercise.exercise_name || ''

        const matchingExercise = selectedExercises.find(
          (selected) =>
            exerciseName.toLowerCase().includes(selected.toLowerCase()) ||
            selected.toLowerCase().includes(exerciseName.toLowerCase())
        )

        if (matchingExercise && exercise.sets && exercise.sets.length > 0) {
          const extractNumberFromRange = (rangeStr: string | null | undefined): number => {
            if (!rangeStr) return 0

            const formatted = formatRangeDisplay(rangeStr)
            if (!formatted) return 0

            if (!formatted.includes('-')) {
              const num = parseFloat(formatted)
              return isNaN(num) ? 0 : num
            }

            const parts = formatted.split('-')
            const upper = parseFloat(parts[1]?.trim() || parts[0]?.trim() || '0')
            return isNaN(upper) ? 0 : upper
          }

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

        let hasData = false
        for (const exerciseName of selectedExercises) {
          const weight = exerciseMap.get(exerciseName)
          if (weight && weight > 0) {
            point[exerciseName] = weight
            hasData = true
          } else {
            point[exerciseName] = null
          }
        }

        return hasData ? point : null
      })
      .filter((point): point is ExerciseDataPoint => point !== null)
      .sort((a, b) => a.timestamp - b.timestamp)

    return dataPoints
  }, [sessions, daysView, selectedExercises])

  const option = useMemo(
    () => ({
      grid: { left: 16, right: 12, top: 24, bottom: 8, containLabel: true },
      legend: {
        show: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: variables.card,
        borderColor: variables.border,
        textStyle: { color: variables.foreground, fontSize: 12 },
        formatter: (params: Array<{ seriesName: string; value: number | null; marker: string; axisValue: string }>) => {
          const rows = params.filter((item) => item.value != null && Number(item.value) > 0)
          if (rows.length === 0) return ''
          const lines = rows.map((item) => `${item.marker} ${item.seriesName}: ${Number(item.value).toFixed(1)} lbs`)
          return `${params[0]?.axisValue}<br/>${lines.join('<br/>')}`
        },
      },
      xAxis: {
        type: 'category',
        data: chartData.map((row) => row.formattedDate),
        axisLine: { lineStyle: { color: variables.border } },
        axisTick: { show: false },
        axisLabel: { color: variables.mutedForeground, fontSize: 11, rotate: 45 },
      },
      yAxis: {
        type: 'value',
        name: 'Weight (lbs)',
        nameTextStyle: { color: variables.mutedForeground, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: variables.border, type: 'dashed' } },
        axisLabel: { color: variables.mutedForeground, fontSize: 11 },
      },
      series: selectedExercises.map((exerciseName, index) => ({
        name: exerciseName,
        type: 'line',
        smooth: true,
        connectNulls: true,
        showSymbol: true,
        symbolSize: 7,
        data: chartData.map((point) => {
          const value = point[exerciseName]
          return typeof value === 'number' && value > 0 ? value : null
        }),
        lineStyle: {
          color: EXERCISE_COLORS[index % EXERCISE_COLORS.length],
          width: 2,
        },
        itemStyle: {
          color: EXERCISE_COLORS[index % EXERCISE_COLORS.length],
        },
      })),
    }),
    [chartData, selectedExercises, variables]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
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

      <div className="flex flex-wrap gap-2">
        {selectedExercises.map((exerciseName, index) => (
          <div
            key={exerciseName}
            className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-md"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: EXERCISE_COLORS[index % EXERCISE_COLORS.length] }}
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

      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Weight Progression</h3>
        {chartData.length === 0 || selectedExercises.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No weight data available for the selected exercises and period.</p>
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
        )}
      </div>
    </div>
  )
}
