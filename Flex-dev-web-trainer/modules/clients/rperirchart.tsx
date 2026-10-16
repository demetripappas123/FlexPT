'use client'

import React, { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { useTheme } from '@/context/themecontext'
import { formatRangeDisplay } from '@/supabase/utils/rangeparse'

type RPERIRChartProps = {
  sessions: SessionWithExercises[]
}

type RPERIRDataPoint = {
  date: string
  average: number
  formattedDate: string
  count: number
  color: string
}

export default function RPERIRChart({ sessions }: RPERIRChartProps) {
  const { variables } = useTheme()
  const [daysView, setDaysView] = useState<30 | 60 | 90>(30)
  const [metricType, setMetricType] = useState<'RPE' | 'RIR'>('RPE')

  const extractNumberFromRange = (rangeStr: string | null | undefined): number | null => {
    if (!rangeStr) return null

    const formatted = formatRangeDisplay(rangeStr)
    if (!formatted) return null

    if (!formatted.includes('-')) {
      const num = parseFloat(formatted)
      return isNaN(num) ? null : num
    }

    const parts = formatted.split('-')
    const lower = parseFloat(parts[0]?.trim() || '')
    return isNaN(lower) ? null : lower
  }

  const calculateSessionAverage = (session: SessionWithExercises, type: 'RPE' | 'RIR'): { average: number; count: number } => {
    if (!session.exercises || session.exercises.length === 0) {
      return { average: 0, count: 0 }
    }

    let total = 0
    let count = 0

    for (const exercise of session.exercises) {
      if (exercise.sets && exercise.sets.length > 0) {
        for (const set of exercise.sets) {
          const rangeValue = type === 'RPE' ? set.rpe : set.rir
          const value = extractNumberFromRange(rangeValue)
          if (value !== null && value !== undefined) {
            total += value
            count++
          }
        }
      }
    }

    if (count === 0) {
      return { average: 0, count: 0 }
    }

    return { average: total / count, count }
  }

  const chartData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now)
    cutoffDate.setDate(cutoffDate.getDate() - daysView)

    const sessionsWithAverage = sessions
      .filter((session) => {
        if (!session.started_at) return false
        const sessionDate = new Date(session.started_at)
        if (isNaN(sessionDate.getTime())) return false
        return sessionDate >= cutoffDate && sessionDate <= now
      })
      .map((session) => {
        const { average, count } = calculateSessionAverage(session, metricType)
        const date = new Date(session.started_at!)
        return {
          date: date.toISOString().split('T')[0],
          average,
          count,
          timestamp: date.getTime(),
        }
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => a.timestamp - b.timestamp)

    const averageByDate = new Map<string, { total: number; totalCount: number }>()
    for (const item of sessionsWithAverage) {
      const existing = averageByDate.get(item.date) || { total: 0, totalCount: 0 }
      averageByDate.set(item.date, {
        total: existing.total + item.average * item.count,
        totalCount: existing.totalCount + item.count,
      })
    }

    const getColorForValue = (value: number): string => {
      if (metricType === 'RPE') {
        if (value >= 9) {
          return '#cf2d56'
        } else if (value >= 8.5) {
          const ratio = (value - 8.5) / 0.5
          if (ratio < 0.5) {
            const subRatio = ratio * 2
            const r = Math.round(234 + (249 - 234) * subRatio)
            const g = Math.round(179 + (115 - 179) * subRatio)
            const b = Math.round(8 + (22 - 8) * subRatio)
            return `rgb(${r}, ${g}, ${b})`
          } else {
            const subRatio = (ratio - 0.5) * 2
            const r = Math.round(249 + (239 - 249) * subRatio)
            const g = Math.round(115 + (68 - 115) * subRatio)
            const b = Math.round(22 + (68 - 22) * subRatio)
            return `rgb(${r}, ${g}, ${b})`
          }
        } else {
          const ratio = (value - 5) / 3.5
          const r = Math.round(34 - (22 - 34) * ratio)
          const g = Math.round(197 - (163 - 197) * ratio)
          const b = Math.round(94 - (52 - 94) * ratio)
          return `rgb(${r}, ${g}, ${b})`
        }
      }
      if (value <= 0) return '#cf2d56'
      if (value <= 1) return '#f54e00'
      if (value <= 2) return '#c08532'
      return '#1f8a65'
    }

    const data: RPERIRDataPoint[] = Array.from(averageByDate.entries())
      .map(([date, { total, totalCount }]) => {
        const dateObj = new Date(date)
        const average = total / totalCount
        return {
          date,
          average,
          count: totalCount,
          formattedDate: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          color: getColorForValue(average),
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return data
  }, [sessions, daysView, metricType])

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
          return `${item.name}<br/>Avg ${metricType}: ${Number(item.value).toFixed(2)}`
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
        min: metricType === 'RPE' ? 5 : 0,
        max: metricType === 'RPE' ? 10 : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: variables.border, type: 'dashed' } },
        axisLabel: {
          color: variables.mutedForeground,
          fontSize: 11,
          formatter: (value: number) => value.toFixed(1),
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 20,
          data: chartData.map((row) => ({
            value: Number(row.average.toFixed(2)),
            itemStyle: { color: row.color, borderRadius: [2, 2, 0, 0] },
          })),
        },
      ],
    }),
    [chartData, metricType, variables]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

        <div className="flex gap-2">
          <button
            onClick={() => setMetricType('RPE')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              metricType === 'RPE'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            } cursor-pointer`}
          >
            RPE
          </button>
          <button
            onClick={() => setMetricType('RIR')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              metricType === 'RIR'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            } cursor-pointer`}
          >
            RIR
          </button>
        </div>
      </div>

      <div className="bg-background border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Average {metricType} per Workout
        </h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No {metricType} data available for the selected period.</p>
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: 300, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
        )}
      </div>
    </div>
  )
}
