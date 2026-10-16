'use client'

import React, { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'
import { useTheme } from '@/context/themecontext'

type NutritionChartProps = {
  entries: NutritionEntry[]
  goals?: NutritionGoal[]
}

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export default function NutritionChart({ entries, goals = [] }: NutritionChartProps) {
  const { variables } = useTheme()
  const [visibleMacros, setVisibleMacros] = useState({
    protein: true,
    carbs: true,
    fats: true,
  })

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })

  const selectedDate = new Date(selectedMonth + 'T00:00:00')
  const selectedMonthNum = selectedDate.getMonth() + 1
  const selectedYear = selectedDate.getFullYear()

  const monthlyEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const d = parseLocalDate(entry.entry_date)
        return d.getMonth() + 1 === selectedMonthNum && d.getFullYear() === selectedYear
      })
      .sort((a, b) => parseLocalDate(a.entry_date).getTime() - parseLocalDate(b.entry_date).getTime())
  }, [entries, selectedMonthNum, selectedYear])

  const formatMonthDisplay = (monthStr: string) => {
    const date = new Date(monthStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + 'T00:00:00')
    const currentYear = date.getFullYear()
    const currentMonth = date.getMonth()

    let newYear = currentYear
    let newMonth = currentMonth

    if (direction === 'prev') {
      if (currentMonth === 0) {
        newMonth = 11
        newYear = currentYear - 1
      } else {
        newMonth = currentMonth - 1
      }
    } else if (currentMonth === 11) {
      newMonth = 0
      newYear = currentYear + 1
    } else {
      newMonth = currentMonth + 1
    }

    setSelectedMonth(`${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`)
  }

  const allDaysInMonth = useMemo(() => {
    const days: Date[] = []
    const year = selectedYear
    const month = selectedMonthNum - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }, [selectedYear, selectedMonthNum])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, NutritionEntry>()
    monthlyEntries.forEach((entry) => {
      map.set(entry.entry_date, entry)
    })
    return map
  }, [monthlyEntries])

  const currentGoal = useMemo(() => {
    return goals.find((g) => g.goal_month === selectedMonth) || null
  }, [goals, selectedMonth])

  const getColorForValue = (value: number | null | undefined, goal: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value as number) || value === 0) {
      return '#a09c92'
    }
    if (goal === null || goal === undefined || isNaN(goal) || goal === 0) {
      return '#a09c92'
    }

    const percentage = (value / goal) * 100
    if (percentage >= 100) return '#1f8a65'
    if (percentage >= 80) return '#c08532'
    return '#cf2d56'
  }

  const chartData = useMemo(() => {
    return allDaysInMonth.map((day) => {
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      const entry = entriesByDate.get(dateStr)
      const dayNum = day.getDate()
      const fullDate = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

      const calories = typeof entry?.calories === 'number' ? entry.calories : 0
      const protein = typeof entry?.protein_grams === 'number' ? entry.protein_grams : 0
      const carbs = typeof entry?.carbs_grams === 'number' ? entry.carbs_grams : 0
      const fats = typeof entry?.fats_grams === 'number' ? entry.fats_grams : 0

      return {
        day: dayNum,
        fullDate,
        calories,
        protein,
        carbs,
        fats,
        caloriesColor: entry ? getColorForValue(calories, currentGoal?.calorie_goal) : '#a09c92',
        proteinColor: entry ? getColorForValue(protein, currentGoal?.protein_goal) : '#a09c92',
        carbsColor: entry ? getColorForValue(carbs, currentGoal?.carbs_goal) : '#a09c92',
        fatsColor: entry ? getColorForValue(fats, currentGoal?.fats_goal) : '#a09c92',
      }
    })
  }, [allDaysInMonth, entriesByDate, currentGoal])

  const dayLabels = chartData.map((row) => String(row.day))

  const caloriesOption = useMemo(
    () => ({
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: variables.card,
        borderColor: variables.border,
        textStyle: { color: variables.foreground, fontSize: 12 },
        formatter: (params: Array<{ dataIndex: number; value: number; marker: string }>) => {
          const item = params?.[0]
          if (!item) return ''
          const row = chartData[item.dataIndex]
          return `${row?.fullDate}<br/>${item.marker} Calories: <b>${item.value} cal</b>`
        },
      },
      xAxis: {
        type: 'category',
        data: dayLabels,
        axisLine: { lineStyle: { color: variables.border } },
        axisTick: { show: false },
        axisLabel: {
          color: variables.mutedForeground,
          fontSize: 11,
          interval: 0,
          formatter: (value: string) => (Number(value) % 5 === 0 ? value : ''),
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: variables.border, type: 'dashed' } },
        axisLabel: { color: variables.mutedForeground, fontSize: 11 },
      },
      series: [
        {
          name: 'Calories',
          type: 'bar',
          barMaxWidth: 12,
          data: chartData.map((row) => ({
            value: row.calories,
            itemStyle: { color: row.caloriesColor, borderRadius: [4, 4, 0, 0] },
          })),
        },
      ],
    }),
    [chartData, dayLabels, variables]
  )

  const macrosOption = useMemo(
    () => ({
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      legend: {
        top: 0,
        data: ['Protein', 'Carbs', 'Fats'],
        selected: {
          Protein: visibleMacros.protein,
          Carbs: visibleMacros.carbs,
          Fats: visibleMacros.fats,
        },
        textStyle: { color: variables.mutedForeground, fontSize: 12 },
        icon: 'rect',
        itemWidth: 12,
        itemHeight: 12,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: variables.card,
        borderColor: variables.border,
        textStyle: { color: variables.foreground, fontSize: 12 },
        formatter: (params: Array<{ seriesName: string; value: number; marker: string; dataIndex: number }>) => {
          const row = chartData[params?.[0]?.dataIndex]
          if (!row) return ''
          const lines = params
            .filter((item) => item.value != null)
            .map((item) => `${item.marker} ${item.seriesName}: <b>${item.value}g</b>`)
          return `${row.fullDate}<br/>${lines.join('<br/>')}`
        },
      },
      xAxis: {
        type: 'category',
        data: dayLabels,
        axisLine: { lineStyle: { color: variables.border } },
        axisTick: { show: false },
        axisLabel: {
          color: variables.mutedForeground,
          fontSize: 11,
          interval: 0,
          formatter: (value: string) => (Number(value) % 5 === 0 ? value : ''),
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: variables.border, type: 'dashed' } },
        axisLabel: { color: variables.mutedForeground, fontSize: 11 },
      },
      series: [
        {
          name: 'Protein',
          type: 'bar',
          barMaxWidth: 10,
          data: chartData.map((row) => ({
            value: row.protein,
            itemStyle: { color: row.proteinColor, borderRadius: [4, 4, 0, 0] },
          })),
        },
        {
          name: 'Carbs',
          type: 'bar',
          barMaxWidth: 10,
          data: chartData.map((row) => ({
            value: row.carbs,
            itemStyle: { color: row.carbsColor, borderRadius: [4, 4, 0, 0] },
          })),
        },
        {
          name: 'Fats',
          type: 'bar',
          barMaxWidth: 10,
          data: chartData.map((row) => ({
            value: row.fats,
            itemStyle: { color: row.fatsColor, borderRadius: [4, 4, 0, 0] },
          })),
        },
      ],
    }),
    [chartData, dayLabels, variables, visibleMacros]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer text-secondary-foreground"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-foreground">
          {formatMonthDisplay(selectedMonth)}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer text-secondary-foreground"
        >
          →
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Calories</h3>
        <div className="bg-background rounded-md p-4">
          <ReactECharts option={caloriesOption} style={{ height: 300, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Macros (g)</h3>
        <div className="bg-background rounded-md p-4">
          <ReactECharts
            option={macrosOption}
            style={{ height: 300, width: '100%' }}
            opts={{ renderer: 'svg' }}
            notMerge
            onEvents={{
              legendselectchanged: (params: { selected: Record<string, boolean> }) => {
                setVisibleMacros({
                  protein: params.selected.Protein !== false,
                  carbs: params.selected.Carbs !== false,
                  fats: params.selected.Fats !== false,
                })
              },
            }}
          />
        </div>
      </div>

      {monthlyEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-background border border-border rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Avg Calories</div>
            <div className="text-lg font-semibold text-foreground">
              {Math.round(
                monthlyEntries.reduce((sum, e) => sum + (e.calories || 0), 0) / monthlyEntries.length
              ) || 0}
            </div>
          </div>
          <div className="p-3 bg-background border border-border rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Avg Protein</div>
            <div className="text-lg font-semibold text-foreground">
              {Math.round(
                monthlyEntries.reduce((sum, e) => sum + (e.protein_grams || 0), 0) / monthlyEntries.length
              ) || 0}g
            </div>
          </div>
          <div className="p-3 bg-background border border-border rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Avg Carbs</div>
            <div className="text-lg font-semibold text-foreground">
              {Math.round(
                monthlyEntries.reduce((sum, e) => sum + (e.carbs_grams || 0), 0) / monthlyEntries.length
              ) || 0}g
            </div>
          </div>
          <div className="p-3 bg-background border border-border rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Avg Fats</div>
            <div className="text-lg font-semibold text-foreground">
              {Math.round(
                monthlyEntries.reduce((sum, e) => sum + (e.fats_grams || 0), 0) / monthlyEntries.length
              ) || 0}g
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
