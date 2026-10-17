'use client'

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme } from '@/context/themecontext'
import { chartTheme, rateColor, rateGaugeOption } from '@/modules/dashboard/charttheme'

type ShowRateChartProps = {
  showRate: number | null
  compact?: boolean
}

export default function ShowRateChart({ showRate, compact = false }: ShowRateChartProps) {
  const { theme } = useTheme()
  const colors = useMemo(() => chartTheme(), [theme])
  const unavailable = showRate == null
  const value = unavailable ? 0 : Math.max(0, Math.min(100, showRate))
  const color = rateColor(value, 'show')

  const option = useMemo(() => rateGaugeOption(value, color, colors), [colors, color, value])

  const size = compact ? 56 : 140

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ReactECharts option={option} style={{ width: size, height: size }} opts={{ renderer: 'svg' }} notMerge />
        <div className={`pointer-events-none absolute inset-0 flex items-center justify-center font-medium tracking-tight text-foreground ${compact ? 'text-[10px]' : 'text-sm'}`}>
          {unavailable ? 'N/A' : `${value.toFixed(compact ? 0 : 1)}%`}
        </div>
      </div>
      <h3 className={`font-semibold text-foreground ${compact ? 'text-[10px] mt-0.5' : 'text-xs -mt-1'}`}>Show Rate</h3>
      {!compact && <div className="text-[9px] text-muted-foreground mt-0.5">Sessions Completed</div>}
    </div>
  )
}
