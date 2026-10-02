'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { useTheme } from '@/context/themecontext'
import { formatRangeDisplay } from '@/supabase/utils/rangeparse'

type WorkoutVolumeChartProps = {
  sessions: SessionWithExercises[]
}

type VolumeDataPoint = {
  date: string
  volume: number
  formattedDate: string
  color: string
}

export default function WorkoutVolumeChart({ sessions }: WorkoutVolumeChartProps) {
  const { variables } = useTheme()
  const [daysView, setDaysView] = useState<30 | 60 | 90>(30)

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
    
    // If it's a range like "8-12", use the lower bound for completed workouts
    const parts = formatted.split('-')
    const lower = parseFloat(parts[0]?.trim() || '0')
    return isNaN(lower) ? 0 : lower
  }

  // Calculate volume for each session
  const calculateSessionVolume = (session: SessionWithExercises): number => {
    if (!session.exercises || session.exercises.length === 0) return 0

    let totalVolume = 0
    for (const exercise of session.exercises) {
      if (exercise.sets && exercise.sets.length > 0) {
        for (const set of exercise.sets) {
          const weight = extractNumberFromRange(set.weight)
          const reps = extractNumberFromRange(set.reps)
          totalVolume += weight * reps
        }
      }
    }
    return totalVolume
  }

  // Process data for the selected time period
  const chartData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysView)

    // Filter sessions within the time period and calculate volume
    // Use started_at which should contain workout_date from the workout
    const sessionsWithVolume = sessions
      .filter((session) => {
        // started_at should contain workout_date from the workout mapping
        if (!session.started_at) return false
        const sessionDate = new Date(session.started_at)
        if (isNaN(sessionDate.getTime())) return false
        return sessionDate >= cutoffDate && sessionDate <= now
      })
      .map((session) => {
        const volume = calculateSessionVolume(session)
        // started_at contains workout_date from the workout
        const date = new Date(session.started_at!)
        return {
          date: date.toISOString().split('T')[0], // YYYY-MM-DD
          volume,
          timestamp: date.getTime(),
        }
      })
      .filter((item) => item.volume > 0) // Only include sessions with volume
      .sort((a, b) => a.timestamp - b.timestamp)

    // Group by date and sum volumes for the same day
    const volumeByDate = new Map<string, number>()
    for (const item of sessionsWithVolume) {
      const existing = volumeByDate.get(item.date) || 0
      volumeByDate.set(item.date, existing + item.volume)
    }

    // Convert to array and format for chart
    const sortedData = Array.from(volumeByDate.entries())
      .map(([date, volume]) => {
        const dateObj = new Date(date)
        return {
          date,
          volume: Math.round(volume), // Round to nearest whole number
          formattedDate: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Add candlestick coloring based on trend
    const data: VolumeDataPoint[] = sortedData.map((point, index) => {
      // Determine color based on trend (candlestick style)
      if (index === 0) {
        // First point defaults to green
        return { ...point, color: '#10b981' }
      }
      
      const prevVolume = sortedData[index - 1].volume
      if (point.volume > prevVolume) {
        // Increasing - green
        return { ...point, color: '#10b981' }
      } else if (point.volume < prevVolume) {
        // Decreasing - red (first bar in decreasing trend)
        return { ...point, color: '#ef4444' }
      } else {
        // Same volume - keep previous color
        const prevColor = data[index - 1]?.color || '#10b981'
        return { ...point, color: prevColor }
      }
    })

    return data
  }, [sessions, daysView])

  const formatVolume = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`
    }
    return value.toString()
  }

  return (
    <div className="space-y-4">
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

      {/* Chart */}
      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Total Workout Volume</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No workout data available for the selected period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
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
                tickFormatter={formatVolume}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: variables.card,
                  border: `1px solid ${variables.border}`,
                  borderRadius: '6px',
                  color: variables.foreground,
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} lbs`,
                  'Volume',
                ]}
                labelStyle={{ color: variables.foreground }}
                cursor={{ fill: 'transparent' }}
              />
              <Bar
                dataKey="volume"
                radius={[2, 2, 0, 0]}
                style={{ cursor: 'pointer' }}
                barSize={20}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

