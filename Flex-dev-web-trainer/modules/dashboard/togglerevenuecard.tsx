'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReactECharts from 'echarts-for-react'
import { fetchHistoricalRevenue, HistoricalRevenuePoint } from '@/supabase/fetches/fetchhistoricalrevenue'
import { DateRange } from '@/supabase/utils/daterange'
import { useTheme } from '@/context/themecontext'

type ToggleRevenueCardProps = {
  mtdRevenue: number | null
  projectedRevenue: number | null
  trainedRevenue: number | null
  dateRange: DateRange
  trainerId?: string | null
}

type RevenueType = 'mtd' | 'projected' | 'trained'

export default function ToggleRevenueCard({
  mtdRevenue,
  projectedRevenue,
  trainedRevenue,
  dateRange,
  trainerId,
}: ToggleRevenueCardProps) {
  const { theme } = useTheme()
  const [currentType, setCurrentType] = useState<RevenueType>('mtd')
  const [historicalData, setHistoricalData] = useState<HistoricalRevenuePoint[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [chartColors, setChartColors] = useState({
    textPrimary: '#9ca3af',
    line: '#26251e',
  })

  useEffect(() => {
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)
    setChartColors({
      textPrimary: computedStyle.getPropertyValue('--muted-foreground').trim() || '#9ca3af',
      line: computedStyle.getPropertyValue('--foreground').trim() || '#26251e',
    })
  }, [theme])

  const revenueTypes: { type: RevenueType; label: string; value: number | null }[] = [
    { type: 'mtd', label: 'Revenue', value: mtdRevenue },
    { type: 'projected', label: 'EOM Projected Revenue', value: projectedRevenue },
    { type: 'trained', label: 'Trained Revenue', value: trainedRevenue },
  ]

  const currentIndex = revenueTypes.findIndex(r => r.type === currentType)
  const currentRevenue = revenueTypes[currentIndex]

  // Fetch historical data when type or date range changes
  useEffect(() => {
    const loadHistoricalData = async () => {
      setLoadingHistory(true)
      try {
        let revenueType: 'revenue' | 'trained' | 'projected' = 'revenue'
        if (currentType === 'trained') {
          revenueType = 'trained'
        } else if (currentType === 'projected') {
          revenueType = 'projected'
        }

        const data = await fetchHistoricalRevenue(trainerId, dateRange, revenueType)
        setHistoricalData(data)
      } catch (err) {
        console.error('Error loading historical revenue:', err)
        setHistoricalData([])
      } finally {
        setLoadingHistory(false)
      }
    }

    loadHistoricalData()
  }, [currentType, dateRange, trainerId])

  const navigateRevenue = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % revenueTypes.length
      : (currentIndex - 1 + revenueTypes.length) % revenueTypes.length
    setCurrentType(revenueTypes[newIndex].type)
  }

  // Prepare chart option
  const chartOption = useMemo(() => {
    if (historicalData.length === 0) return null

    const labels = historicalData.map(d => d.label)
    const values = historicalData.map(d => d.revenue)

    return {
      grid: {
        left: 4,
        right: 12,
        top: 12,
        bottom: 4,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: chartColors.textPrimary,
          fontSize: 10,
          fontWeight: 500,
          rotate: 0,
          margin: 8,
          formatter: (value: string) => {
            // Extract month abbreviation (3 letters) from label
            // Labels might be in format like "Dec 2024" or "Dec"
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            // Try to find month in the label
            for (const month of monthNames) {
              if (value.includes(month)) {
                return month
              }
            }
            // If no match, try to parse as date
            const date = new Date(value)
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-US', { month: 'short' })
            }
            // Fallback: return first 3 characters
            return value.substring(0, 3)
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: chartColors.textPrimary,
          fontSize: 9,
          fontWeight: 500,
        },
        splitLine: {
          show: false,
        },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          data: values,
          smooth: true,
          clip: true,
          symbol: 'none',
          lineStyle: {
            color: chartColors.line,
            width: 2,
            opacity: 0.85,
          },
          itemStyle: {
            color: chartColors.line,
          },
          areaStyle: {
            color: chartColors.line,
            opacity: 0.18,
          },
          emphasis: {
            focus: 'series',
            itemStyle: {
              color: chartColors.line,
            },
          },
        },
      ],
      tooltip: {
        show: false,
      },
      animation: false,
    }
  }, [historicalData, chartColors])

  return (
    <div className="bg-card border border-border rounded-lg p-4 min-h-[300px] h-full flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground">{currentRevenue.label}</h3>
          {currentRevenue.value === null ? (
            <div className="mt-2 h-9 w-36 bg-muted rounded animate-pulse" />
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary shrink-0" />
              <p className="text-3xl font-normal tracking-tight text-foreground tabular-nums">
                ${currentRevenue.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => navigateRevenue('prev')}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigateRevenue('next')}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        {loadingHistory ? (
          <div className="h-full min-h-[160px] rounded bg-muted animate-pulse" />
        ) : chartOption ? (
          <ReactECharts
            option={chartOption}
            style={{ width: '100%', height: '100%', minHeight: 160 }}
            opts={{ renderer: 'svg' }}
          />
        ) : (
          <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-muted-foreground">
            No revenue in this range
          </div>
        )}
      </div>
    </div>
  )
}
