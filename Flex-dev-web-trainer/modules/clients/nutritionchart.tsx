'use client'

import React, { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'
import { useTheme } from '@/context/themecontext'

type NutritionChartProps = {
  entries: NutritionEntry[]
  goals?: NutritionGoal[]
}

// Helper function to parse date string (YYYY-MM-DD) as local date to avoid timezone issues
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day) // month is 0-indexed in Date constructor
}

export default function NutritionChart({ entries, goals = [] }: NutritionChartProps) {
  const { variables } = useTheme()
  // State to track which macros are visible
  const [visibleMacros, setVisibleMacros] = useState({
    protein: true,
    carbs: true,
    fats: true,
  })

  // Default to current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })

  // Parse selected month
  const selectedDate = new Date(selectedMonth + 'T00:00:00')
  const selectedMonthNum = selectedDate.getMonth() + 1
  const selectedYear = selectedDate.getFullYear()

  // Filter entries for selected month and sort
  const monthlyEntries = useMemo(() => {
    return entries
      .filter(entry => {
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
    } else {
      if (currentMonth === 11) {
        newMonth = 0
        newYear = currentYear + 1
      } else {
        newMonth = currentMonth + 1
      }
    }
    
    setSelectedMonth(`${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`)
  }

  // Generate all days in the selected month
  const allDaysInMonth = useMemo(() => {
    const days: Date[] = []
    const year = selectedYear
    const month = selectedMonthNum - 1 // JavaScript months are 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate() // Last day of month
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }, [selectedYear, selectedMonthNum])

  // Create a map of entries by date string (YYYY-MM-DD) for quick lookup
  const entriesByDate = useMemo(() => {
    const map = new Map<string, NutritionEntry>()
    monthlyEntries.forEach(entry => {
      map.set(entry.entry_date, entry)
    })
    return map
  }, [monthlyEntries])

  // Find goal for selected month (goal_month format: 'YYYY-MM-01')
  const currentGoal = useMemo(() => {
    return goals.find(g => g.goal_month === selectedMonth) || null
  }, [goals, selectedMonth])

  // Helper function to determine color based on value vs goal
  // ALWAYS returns a string - NEVER undefined/null to prevent toLowerCase errors
  const getColorForValue = (value: number | null | undefined, goal: number | null | undefined): string => {
    // Defensive: handle ALL edge cases - undefined, null, NaN, 0 (no data), invalid values
    if (value === null || value === undefined || isNaN(value as number) || value === 0) {
      return '#9ca3af' // gray for no data (0 means no entry)
    }
    if (goal === null || goal === undefined || isNaN(goal) || goal === 0) {
      return '#9ca3af' // gray for no goal
    }
    
    const percentage = (value / goal) * 100
    
    if (percentage >= 100) {
      return '#22c55e' // green - at or above goal
    } else if (percentage >= 80) {
      return '#eab308' // yellow - close to goal (80-100%)
    } else {
      return '#ef4444' // red - far from goal (below 80%)
    }
  }

  // Defensive helper: ensure value is always a number, use 0 for missing data
  const safeDataValue = (value: number | null | undefined): number => {
    if (value === undefined || value === null || isNaN(value)) {
      return 0 // Use 0 instead of null for missing data
    }
    return value
  }

  // Defensive helper: ensure color is ALWAYS a valid string, NEVER undefined/null
  const safeColorString = (color: string | null | undefined): string => {
    // Handle all edge cases explicitly
    if (color === undefined || color === null) {
      return '#9ca3af' // fallback gray
    }
    if (typeof color !== 'string') {
      return '#9ca3af' // fallback gray
    }
    if (color === '' || color === 'undefined' || color === 'null') {
      return '#9ca3af' // fallback gray
    }
    return color
  }

  // Prepare chart data for Recharts - array of objects, one per day
  const chartData = useMemo(() => {
    const data: Array<{
      day: number
      dayLabel: string
      fullDate: string
      calories: number
      protein: number
      carbs: number
      fats: number
      caloriesColor: string
      proteinColor: string
      carbsColor: string
      fatsColor: string
    }> = []

    allDaysInMonth.forEach((day) => {
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      const entry = entriesByDate.get(dateStr)
      
      const dayNum = day.getDate()
      const dayLabel = dayNum % 5 === 0 ? dayNum.toString() : ''
      const fullDate = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      
      // Extract values - use 0 for days without an entry
      const calories = typeof entry?.calories === 'number' ? entry.calories : 0
      const protein = typeof entry?.protein_grams === 'number' ? entry.protein_grams : 0
      const carbs = typeof entry?.carbs_grams === 'number' ? entry.carbs_grams : 0
      const fats = typeof entry?.fats_grams === 'number' ? entry.fats_grams : 0
      
      // Get goal values
      const calorieGoal = currentGoal?.calorie_goal ?? null
      const proteinGoal = currentGoal?.protein_goal ?? null
      const carbsGoal = currentGoal?.carbs_goal ?? null
      const fatsGoal = currentGoal?.fats_goal ?? null

      // Generate colors
      const caloriesColor = entry 
        ? safeColorString(getColorForValue(calories, calorieGoal))
        : '#9ca3af'
      const proteinColor = entry
        ? safeColorString(getColorForValue(protein, proteinGoal))
        : '#9ca3af'
      const carbsColor = entry
        ? safeColorString(getColorForValue(carbs, carbsGoal))
        : '#9ca3af'
      const fatsColor = entry
        ? safeColorString(getColorForValue(fats, fatsGoal))
        : '#9ca3af'

      data.push({
        day: dayNum,
        dayLabel,
        fullDate,
        calories,
        protein,
        carbs,
        fats,
        caloriesColor,
        proteinColor,
        carbsColor,
        fatsColor,
      })
    })

    return data
  }, [allDaysInMonth, entriesByDate, currentGoal])

  // Custom tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    
    const data = payload[0]?.payload
    if (!data) return null
    
    return (
      <div className="bg-card border border-border rounded-md p-3">
        <div className="text-muted-foreground text-xs mb-2">{data.fullDate}</div>
        {payload.map((entry: any, idx: number) => (
          <div
            key={idx}
            style={{ color: entry.color }}
            className="text-sm mt-1 text-foreground"
          >
            {entry.name}: <strong>{entry.value}{entry.dataKey === 'calories' ? ' cal' : 'g'}</strong>
          </div>
        ))}
      </div>
    )
  }

  // Handle legend click to toggle visibility
  const handleLegendClick = (dataKey: string) => {
    setVisibleMacros(prev => ({
      ...prev,
      [dataKey.toLowerCase()]: !prev[dataKey.toLowerCase() as keyof typeof prev],
    }))
  }

  // Custom legend component with click handler
  const CustomLegend = (props: any) => {
    const { payload } = props
    if (!payload || !Array.isArray(payload)) return null
    
    return (
      <div className="flex justify-center gap-6 pt-2.5">
        {payload.map((entry: any) => {
          // Map entry value to dataKey (Protein -> protein, Carbs -> carbs, Fats -> fats)
          const valueToKey: Record<string, string> = {
            'Protein': 'protein',
            'Carbs': 'carbs',
            'Fats': 'fats',
          }
          const dataKey = entry.dataKey || valueToKey[entry.value] || entry.value?.toLowerCase()
          const isVisible = visibleMacros[dataKey as keyof typeof visibleMacros] ?? true
          
          return (
            <div
              key={entry.value}
              onClick={() => handleLegendClick(dataKey)}
              className="flex items-center gap-2 cursor-pointer"
              style={{ opacity: isVisible ? 1 : 0.5 }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: isVisible ? entry.color : '#9ca3af',
                  border: `1px solid ${isVisible ? entry.color : '#9ca3af'}`,
                }}
              />
              <span className="text-muted-foreground">{entry.value}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
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

      {/* Calories Chart */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Calories</h3>
        <div className="bg-background rounded-md p-4">
          <style dangerouslySetInnerHTML={{__html: `
            .recharts-bar-rectangle {
              cursor: pointer !important;
            }
            .recharts-bar-rectangle:hover {
              opacity: 0.8;
            }
            .recharts-tooltip-cursor {
              fill: transparent !important;
            }
          `}} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke={variables.border} vertical={false} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: variables.mutedForeground, fontSize: 11 }}
                axisLine={{ stroke: variables.border }}
                tickLine={{ stroke: variables.border }}
              />
              <YAxis
                tick={{ fill: variables.mutedForeground, fontSize: 11 }}
                axisLine={{ stroke: variables.border }}
                tickLine={{ stroke: variables.border }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.caloriesColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Macros Chart */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Macros (g)</h3>
        <div className="bg-background rounded-md p-4">
          <style dangerouslySetInnerHTML={{__html: `
            .recharts-bar-rectangle {
              cursor: pointer !important;
            }
            .recharts-bar-rectangle:hover {
              opacity: 0.8;
            }
            .recharts-tooltip-cursor {
              fill: transparent !important;
            }
          `}} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke={variables.border} vertical={false} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: variables.mutedForeground, fontSize: 11 }}
                axisLine={{ stroke: variables.border }}
                tickLine={{ stroke: variables.border }}
              />
              <YAxis
                tick={{ fill: variables.mutedForeground, fontSize: 11 }}
                axisLine={{ stroke: variables.border }}
                tickLine={{ stroke: variables.border }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Legend content={<CustomLegend />} />
              <Bar 
                dataKey="protein" 
                name="Protein" 
                radius={[4, 4, 0, 0]} 
                hide={!visibleMacros.protein}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`protein-${index}`} fill={entry.proteinColor} />
                ))}
              </Bar>
              <Bar 
                dataKey="carbs" 
                name="Carbs" 
                radius={[4, 4, 0, 0]} 
                hide={!visibleMacros.carbs}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`carbs-${index}`} fill={entry.carbsColor} />
                ))}
              </Bar>
              <Bar 
                dataKey="fats" 
                name="Fats" 
                radius={[4, 4, 0, 0]} 
                hide={!visibleMacros.fats}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`fats-${index}`} fill={entry.fatsColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
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

