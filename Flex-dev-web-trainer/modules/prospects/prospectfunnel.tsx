'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ReactECharts from 'echarts-for-react'
import { CalendarRange, Percent } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { supabase } from '@/supabase/supabaseClient'
import { useTheme } from '@/context/themecontext'
import { chartTheme } from '@/modules/dashboard/charttheme'
import { SessionType } from '@/supabase/fetches/fetchsessions'
import { fetchProspectFunnel, LeadFlowSession, ProspectFunnel, ProspectLeadRow } from '@/supabase/fetches/fetchprospectfunnel'
import { PROSPECT_SESSION_TYPES } from '@/supabase/utils/dashboardMetrics'
import {
  ProspectPeriod,
  formatProspectPeriod,
  prospectPeriodBounds,
} from '@/supabase/utils/daterange'

const PERIODS: { id: ProspectPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'custom', label: 'Custom' },
  { id: 'lifetime', label: 'Lifetime' },
]

const TYPE_LABEL: Record<string, string> = {
  'Prospect Session': 'Prospect',
  'Intro Session': 'Intro',
  'Followup Session': 'Follow-up',
}

function formatRate(value: number | null): string {
  if (value == null) return 'N/A'
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
}

function averagePath(lengths: number[]): number | null {
  if (lengths.length === 0) return null
  return Math.round((lengths.reduce((sum, length) => sum + length, 0) / lengths.length) * 10) / 10
}

const NODE_COLOR: Record<string, string> = {
  Booked: '#807d72',
  Closed: '#1f8a65',
  Rescheduled: '#f54e00',
  'Rescheduled again': '#c08532',
  Rejected: '#cf2d56',
  Engaged: '#26251e',
}

function buildFlow(sessions: LeadFlowSession[], types: SessionType[]) {
  const byPerson = new Map<string, LeadFlowSession[]>()
  for (const session of sessions) {
    if (!types.includes(session.type)) continue
    const list = byPerson.get(session.personId) ?? []
    list.push(session)
    byPerson.set(session.personId, list)
  }

  const counts = new Map<string, number>()
  const add = (source: string, target: string) => {
    const key = `${source}\0${target}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  for (const chain of byPerson.values()) {
    const ordered = [...chain].sort((a, b) => a.at - b.at)
    const start = ordered.findIndex((session) => session.inRange)
    if (start < 0) continue
    const steps = ordered.slice(start)
    let from = 'Booked'
    for (let index = 0; index < steps.length && index < 3; index++) {
      const session = steps[index]
      const later = index < steps.length - 1
      const cancelled = session.status === 'canceled_with_charge' || session.status === 'canceled_no_charge'
      let to = 'Engaged'
      if (index >= 2) {
        if (session.closed) to = 'Closed'
        else if (cancelled || session.status === 'completed') to = 'Rejected'
      } else if (later) to = index === 0 ? 'Rescheduled' : 'Rescheduled again'
      else if (session.closed) to = 'Closed'
      else if (cancelled || (session.status === 'completed' && !session.closed)) to = 'Rejected'
      add(from, to)
      if (to !== 'Rescheduled' && to !== 'Rescheduled again') break
      from = to
    }
  }

  const links = [...counts.entries()].map(([key, value]) => {
    const [source, target] = key.split('\0')
    return { source, target, value }
  })
  const names = new Set(links.flatMap((link) => [link.source, link.target]))
  return {
    links,
    nodes: [...names].map((name) => ({
      name,
      itemStyle: { color: NODE_COLOR[name] ?? '#807d72' },
    })),
  }
}

function leadMatches(row: ProspectLeadRow, types: SessionType[], flow: LeadFlowSession[]) {
  if (types.length === PROSPECT_SESSION_TYPES.length) return true
  if (row.status === 'Not booked') return false
  return flow.some((session) => session.personId === row.personId && types.includes(session.type))
}

function formatWhen(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ProspectFunnel() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const colors = useMemo(() => chartTheme(), [theme])
  const [period, setPeriod] = useState<ProspectPeriod>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [funnel, setFunnel] = useState<ProspectFunnel | null>(null)
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<SessionType[]>([...PROSPECT_SESSION_TYPES])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [moving, setMoving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const bounds = useMemo(
    () => prospectPeriodBounds(period, customStart, customEnd),
    [period, customStart, customEnd]
  )
  const rangeLabel = formatProspectPeriod(bounds, period)
  const allTypes = types.length === PROSPECT_SESSION_TYPES.length
  const visible = (funnel?.byType ?? []).filter((row) => types.includes(row.type))
  const dealsClosed = visible.reduce((sum, row) => sum + row.dealsClosed, 0)
  const sessionsPerClose = averagePath(
    (funnel?.paths ?? []).filter((path) => types.includes(path.type)).map((path) => path.sessions)
  )
  const flow = useMemo(
    () => buildFlow(funnel?.flow ?? [], types),
    [funnel?.flow, types]
  )
  const leads = (funnel?.leads ?? []).filter((row) => leadMatches(row, types, funnel?.flow ?? []))
  const hot = leads.filter((row) => row.bucket === 'hot')
  const cold = leads.filter((row) => row.bucket === 'cold')
  const flowOption = useMemo(() => {
    if (flow.links.length === 0) return null
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          data: flow.nodes,
          links: flow.links,
          nodeAlign: 'left',
          nodeWidth: 14,
          nodeGap: 16,
          layoutIterations: 32,
          lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.45 },
          label: {
            color: colors.foreground,
            fontSize: 12,
            formatter: '{b}  {c}',
          },
          edgeLabel: {
            show: true,
            color: colors.foreground,
            fontSize: 11,
            formatter: '{c}',
          },
          emphasis: { focus: 'adjacency' },
        },
      ],
    }
  }, [flow, colors.foreground])

  const toggleType = (type: SessionType) => {
    setTypes((current) => {
      const all = current.length === PROSPECT_SESSION_TYPES.length
      if (all) return [type]
      if (current.includes(type)) {
        const next = current.filter((item) => item !== type)
        return next.length === 0 ? [...PROSPECT_SESSION_TYPES] : next
      }
      return [...current, type]
    })
  }

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    fetchProspectFunnel(user.id, bounds)
      .then((data) => {
        if (!cancelled) setFunnel(data)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setFunnel(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, bounds, reloadKey])

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Lead sessions</h2>
          <p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            {PERIODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  period === option.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setTypes([...PROSPECT_SESSION_TYPES])}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium ${
                allTypes ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {PROSPECT_SESSION_TYPES.map((type) => {
              const on = !allTypes && types.includes(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium ${
                    on ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TYPE_LABEL[type]}
                </button>
              )
            })}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                aria-label="Start date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                aria-label="End date"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Session</th>
                <th className="py-2 pr-3 font-medium">Sessions</th>
                <th className="py-2 pr-3 font-medium">Show</th>
                <th className="py-2 pr-3 font-medium">Close</th>
                <th className="py-2 font-medium">Deals closed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.type} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.label}</td>
                  <td className="py-2.5 pr-3 font-normal tracking-tight text-foreground">
                    {loading ? '…' : row.sessions.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-primary" />
                      <span className="font-normal tracking-tight text-foreground">
                        {loading ? '…' : formatRate(row.showRate)}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-primary" />
                      <span className="font-normal tracking-tight text-foreground">
                        {loading ? '…' : formatRate(row.closeRate)}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 font-normal tracking-tight text-foreground">
                    {loading ? '…' : row.dealsClosed.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border px-3 py-3">
            <p className="text-xs text-muted-foreground">Deals closed</p>
            <p className="mt-2 text-2xl font-normal tracking-tight text-foreground">
              {loading ? '…' : dealsClosed.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 text-primary" />
              Sessions per close
            </div>
            <p className="mt-2 text-2xl font-normal tracking-tight text-foreground">
              {loading ? '…' : sessionsPerClose == null ? 'N/A' : sessionsPerClose.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Includes the closing session</p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[320px]">
        {loading ? (
          <div className="h-full rounded bg-muted animate-pulse" />
        ) : flowOption ? (
          <ReactECharts option={flowOption} style={{ height: 320, width: '100%' }} opts={{ renderer: 'svg' }} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No booked lead sessions in this range
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LeadTable
          title="Hot leads"
          empty="No hot leads"
          rows={hot}
          loading={loading}
          picked={picked}
          moving={moving}
          action="Move to cold"
          onToggle={togglePicked}
          onSelectAll={setPickedRows}
          onMove={() => void moveBucket('cold')}
        />
        <LeadTable
          title="Cold leads"
          empty="No cold leads"
          rows={cold}
          loading={loading}
          picked={picked}
          moving={moving}
          reason
          action="Move to hot"
          onToggle={togglePicked}
          onSelectAll={setPickedRows}
          onMove={() => void moveBucket('hot')}
        />
      </div>
    </section>
  )

  function togglePicked(personId: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  function setPickedRows(ids: string[], on: boolean) {
    setPicked((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  async function moveBucket(bucket: 'hot' | 'cold') {
    const ids = [...picked].filter((id) => leads.some((row) => row.personId === id && row.bucket !== bucket))
    if (ids.length === 0) return
    setMoving(true)
    const { error } = await supabase.from('people').update({ lead_bucket: bucket }).in('id', ids)
    setMoving(false)
    if (error) {
      console.error(error)
      alert('Could not move those leads.')
      return
    }
    setPicked(new Set())
    setReloadKey((key) => key + 1)
  }
}

function LeadTable({
  title,
  empty,
  rows,
  loading,
  reason = false,
  picked,
  moving,
  action,
  onToggle,
  onSelectAll,
  onMove,
}: {
  title: string
  empty: string
  rows: ProspectLeadRow[]
  loading: boolean
  reason?: boolean
  picked: Set<string>
  moving: boolean
  action: string
  onToggle: (personId: string) => void
  onSelectAll: (ids: string[], on: boolean) => void
  onMove: () => void
}) {
  const selectedHere = rows.filter((row) => picked.has(row.personId)).length
  const allChecked = rows.length > 0 && selectedHere === rows.length
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {title}
          <span className="ml-2 text-foreground">{loading ? '' : rows.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(rows.map((row) => row.personId), !allChecked)}
            disabled={loading || rows.length === 0}
            className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allChecked ? 'Clear' : 'Select all'}
          </button>
          <button
            type="button"
            onClick={onMove}
            disabled={moving || selectedHere === 0}
            className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action}{selectedHere > 0 ? ` (${selectedHere})` : ''}
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-14 px-2 py-2">
                <label className="flex h-10 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => onSelectAll(rows.map((row) => row.personId), !allChecked)}
                    aria-label={`Select all ${title}`}
                    className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: '#f54e00' }}
                  />
                </label>
              </th>
              <th className="px-3 py-2 font-medium">Prospect</th>
              <th className="px-3 py-2 font-medium">{reason ? 'Reason' : 'Status'}</th>
              <th className="px-3 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.personId} className="border-b border-border last:border-0">
                  <td className="px-2 py-1">
                    <label className="flex h-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={picked.has(row.personId)}
                        onChange={() => onToggle(row.personId)}
                        aria-label={`Select ${row.name}`}
                        className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: '#f54e00' }}
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/people/${row.personId}`} className="font-medium hover:text-primary">
                      {row.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{row.detail}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatWhen(row.when)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
