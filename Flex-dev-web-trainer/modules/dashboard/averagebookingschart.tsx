'use client'

import React from 'react'

type AverageBookingsChartProps = {
  averageBookings: number
}

export default function AverageBookingsChart({ averageBookings }: AverageBookingsChartProps) {
  return (
    <div className="w-full h-full flex flex-col p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Today's Bookings</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-bold text-foreground">{averageBookings}</div>
          <div className="text-xs text-gray-400 mt-2">Non-client sessions scheduled today</div>
        </div>
      </div>
    </div>
  )
}

