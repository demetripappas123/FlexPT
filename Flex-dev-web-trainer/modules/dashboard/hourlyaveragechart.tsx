'use client'

import React from 'react'

type HourlyAverageChartProps = {
  hourlyAverage: number | null
}

export default function HourlyAverageChart({ hourlyAverage }: HourlyAverageChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-normal tracking-tight text-foreground">
          {hourlyAverage == null ? 'N/A' : formatCurrency(hourlyAverage)}
        </div>
      </div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mt-1">Hourly Rate</h3>
      <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">Average hourly rate</div>
    </div>
  )
}





