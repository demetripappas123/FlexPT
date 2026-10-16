'use client'

import React, { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
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

  const extractNumberFromRange = (rangeStr: string | null | undefined): number => {
    if (!rangeStr) return 0

    const formatted = formatRangeDisplay(rangeStr)
    if (!formatted) return 0

    if (!formatted.includes('-')) {
      const num = parseFloat(formatted)
      return isNaN(num) ? 0 : num
    }

    const parts = formatted.split('-')
    const lower = parseFloat(parts[0]?.trim() || '0')
    return isNaN(lower) ? 0 : lower
  }

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

  const chartData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysView)

    const sessionsWithVolume = sessions
      .filter((session) => {
        if (!session.started_at) return false
        const sessionDate = new Date(session.started_at)
        if (isNaN(sessionDate.getTime())) return false
        return sessionDate >= cutoffDate && sessionDate <= now
      })
      .map((session) => {
        const volume = calculateSessionVolume(session)
        const date = new Date(session.started_at!)
        return {
          date: date.toISOString().split('T')[0],
          volume,
          timestamp: date.getTime(),
        }
      })
      .filter((item) => item.volume > 0)
      .sort((a, b) => a.timestamp - b.timestamp)

    const volumeByDate = new Map<string, number>()
    for (const item of sessionsWithVolume) {
      const existing = volumeByDate.get(item.date) || 0
      volumeByDate.set(item.date, existing + item.volume)
    }

    const sortedData = Array.from(volumeByDate.entries())
      .map(([date, volume]) => {
        const dateObj = new Date(date)
        return {
          date,
          volume: Math.round(volume),
          formattedDate: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let previousColor = '#1f8a65'
    const data: VolumeDataPoint[] = sortedData.map((point, index) => {
      let color = '#1f8a65'
      if (index > 0) {
        const prevVolume = sortedData[index - 1].volume
        if (point.volume > prevVolume) {
          color = '#1f8a65'
        } else if (point.volume < prevVolume) {
          color = '#cf2d56'
        } else {
          color = previousColor
        }
      }
      previousColor = color
      return { ...point, color }
    })

    return data
  }, [sessions, daysView])

  const formatVolume = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`
    }
    return value.toString()
  }

  const option = useMemo(
    () => ({
      grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: variables.card,
        borderColor: variables.border,
        textStyle: { color: variables.foreground, fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const item = params?.[0]
          if (!item) return ''
          return `${item.name}<br/>Volume: ${Number(item.value).toLocaleString()} lbs`
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
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: variables.border, type: 'dashed' } },
        axisLabel: {
          color: variables.mutedForeground,
          fontSize: 11,
          formatter: (value: number) => formatVolume(value),
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 20,
          data: chartData.map((row) => ({
            value: row.volume,
            itemStyle: { color: row.color, borderRadius: [2, 2, 0, 0] },
          })),
        },
      ],
    }),
    [chartData, variables]
  )

  return (
    <div className="space-y-4">
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

      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Total Workout Volume</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No workout data available for the selected period.</p>
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
        )}
      </div>
    </div>
  )
}
