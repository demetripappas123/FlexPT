'use client'

import React from 'react'

type RevenueChartProps = {
  revenue: number
}

export default function RevenueChart({ revenue }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Trained Revenue</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-normal tracking-tight text-foreground">{formatCurrency(revenue)}</div>
          <div className="text-xs text-gray-400 mt-2">From Client Sessions</div>
        </div>
      </div>
    </div>
  )
}

