export type ChartTheme = {
  text: string
  border: string
  card: string
  foreground: string
  primary: string
  muted: string
}

function cssColor(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  if (/^(#|rgb|hsl)/i.test(raw)) return raw
  const probe = document.createElement('span')
  probe.style.color = raw
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  if (!resolved || resolved === 'rgba(0, 0, 0, 0)') return fallback
  return resolved
}

export function chartTheme(): ChartTheme {
  if (typeof window === 'undefined') {
    return {
      text: '#807d72',
      border: '#e6e5e0',
      card: '#ffffff',
      foreground: '#26251e',
      primary: '#f54e00',
      muted: '#e6e5e0',
    }
  }
  const dark = document.documentElement.classList.contains('dark')
  const fallback: ChartTheme = dark
    ? {
        text: '#a09c92',
        border: '#3a3832',
        card: '#26251e',
        foreground: '#f7f7f4',
        primary: '#f54e00',
        muted: '#3a3832',
      }
    : {
        text: '#807d72',
        border: '#e6e5e0',
        card: '#ffffff',
        foreground: '#26251e',
        primary: '#f54e00',
        muted: '#e6e5e0',
      }
  return {
    text: cssColor('--muted-foreground', fallback.text),
    border: cssColor('--border', fallback.border),
    card: cssColor('--card', fallback.card),
    foreground: cssColor('--foreground', fallback.foreground),
    primary: cssColor('--primary', fallback.primary),
    muted: cssColor('--border', fallback.muted),
  }
}

export function rateGaugeOption(value: number, color: string, colors: ChartTheme) {
  const shown = value > 0
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 100,
        radius: '88%',
        pointer: { show: false },
        progress: {
          show: shown,
          roundCap: shown,
          clip: false,
          itemStyle: { color },
        },
        axisLine: {
          lineStyle: { width: 8, color: [[1, colors.muted]] },
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: shown ? value : 0 }],
      },
    ],
  }
}

export function rateColor(percentage: number, kind: 'close' | 'show' = 'close'): string {
  const high = kind === 'show' ? 90 : 80
  const mid = kind === 'show' ? 60 : 40
  if (percentage >= high) return '#1f8a65'
  if (percentage >= mid) return '#c08532'
  return '#cf2d56'
}
