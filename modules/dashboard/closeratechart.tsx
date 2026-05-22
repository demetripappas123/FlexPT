'use client'

import React, { useMemo } from 'react'
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/context/themecontext'

type CloseRateChartProps = {
  closeRate: number // Percentage 0-100
}

export default function CloseRateChart({ closeRate }: CloseRateChartProps) {
  const { variables } = useTheme()
  
  // Use muted or card color for background circle, with fallback
  const bgColor = useMemo(() => {
    return variables.muted || variables.card || '#2a2a2a'
  }, [variables.muted, variables.card])
  // Determine color based on percentage (red to green)
  const getColor = (percentage: number): string => {
    if (percentage >= 80) return '#22c55e' // green-500
    if (percentage >= 60) return '#84cc16' // lime-500
    if (percentage >= 40) return '#eab308' // yellow-500
    if (percentage >= 20) return '#f97316' // orange-500
    return '#ef4444' // red-500
  }

  const color = getColor(closeRate)
  
  // Calculate end angle based on percentage
  // Start at 90 (top), go clockwise
  // 0% = 90, 50% = -90 (semicircle), 100% = -270 (full circle)
  const startAngle = 90
  // Ensure endAngle is always less than startAngle, even for 0%
  const endAngle = closeRate === 0 ? 90.1 : 90 - (360 * closeRate / 100)
  
  const data = [
    {
      name: 'Close Rate',
      value: 100, // Always 100 for the bar, but endAngle controls the fill
      fill: color,
    },
  ]

  // Background circle (100%)
  const backgroundData = [
    {
      name: 'Background',
      value: 100,
      fill: bgColor, // Theme-aware background
    },
  ]

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="relative w-[100px] h-[100px] min-w-[100px] min-h-[100px]">
        <ResponsiveContainer width={100} height={100} minWidth={100} minHeight={100}>
          <RadialBarChart
            innerRadius="60%"
            outerRadius="90%"
            data={backgroundData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <ResponsiveContainer width={100} height={100} minWidth={100} minHeight={100} className="absolute top-0 left-0">
          <RadialBarChart
            innerRadius="60%"
            outerRadius="90%"
            data={data}
            startAngle={startAngle}
            endAngle={endAngle}
          >
            <RadialBar dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-bold text-foreground">
              {closeRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
      <h3 className="text-xs font-semibold text-foreground mt-1">Close Rate</h3>
      <div className="text-[9px] text-muted-foreground mt-0.5">Prospects → Clients</div>
    </div>
  )
}

