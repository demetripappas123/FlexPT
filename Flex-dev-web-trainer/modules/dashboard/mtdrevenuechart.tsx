'use client'

import React from 'react'

type MTDRevenueChartProps = {
  mtdRevenue: number
}

export default function MTDRevenueChart({ mtdRevenue }: MTDRevenueChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-lg font-semibold text-white mb-4">MTD Revenue</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-500">{formatCurrency(mtdRevenue)}</div>
          <div className="text-xs text-gray-400 mt-2">Month To Date</div>
        </div>
      </div>
    </div>
  )
}





