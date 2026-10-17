'use client'

import React, { useMemo } from 'react'
import { PieChart } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import ChartSkeleton from './chartskeleton'
import { useTheme } from '@/context/themecontext'
import { chartTheme } from '@/modules/dashboard/charttheme'

type LeadSource = {
  source: string
  count: number
}

type LeadSourcesChartProps = {
  sources: LeadSource[]
  prospects?: Array<{ created_at: string; lead_source: string | null }>
  loading?: boolean
  dateRange?: 'today' | 'yesterday' | 'weekly' | 'monthly'
}

export default function LeadSourcesChart({ sources, loading }: LeadSourcesChartProps) {
  const { theme } = useTheme()
  const colors = useMemo(() => chartTheme(), [theme])

  const chartData = useMemo(() => {
    if (!sources || sources.length === 0) return []
    return [...sources]
      .sort((a, b) => a.count - b.count)
      .slice(-8)
      .map((source) => ({
        name: source.source || 'Unknown',
        count: source.count,
      }))
  }, [sources])

  const option = useMemo(
    () => ({
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: colors.card,
        borderColor: colors.border,
        textStyle: { color: colors.foreground, fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const item = params?.[0]
          if (!item) return ''
          return `${item.name}<br/>${item.value} leads`
        },
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: colors.text, fontSize: 11 },
        minInterval: 1,
      },
      yAxis: {
        type: 'category',
        data: chartData.map((row) => row.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: colors.text, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: chartData.map((row) => row.count),
          barMaxWidth: 14,
          itemStyle: {
            color: colors.foreground,
            opacity: 0.85,
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
    }),
    [chartData, colors]
  )

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 min-h-[300px]">
        <ChartSkeleton type="bar" title="Lead Sources" />
      </div>
    )
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 min-h-[300px] flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground">Lead sources</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No lead source data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 min-h-[300px] flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground">Lead sources</h3>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ReactECharts option={option} style={{ height: 220, width: '100%' }} opts={{ renderer: 'svg' }} />
      </div>
    </div>
  )
}
