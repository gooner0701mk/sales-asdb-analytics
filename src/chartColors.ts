/** ダッシュボードの Recharts 用。localStorage の AppState に保存する */

export type ChartColorPalette = {
  coldVisit: string
  teleAppo: string
  meeting: string
  reception: string
  quote: string
  closedWon: string
  funnelApproachToMeeting: string
  funnelMeetingToQuote: string
  funnelQuoteToWin: string
  funnelApproachToWin: string
  chartGrid: string
}

export const DEFAULT_CHART_COLORS: ChartColorPalette = {
  coldVisit: '#2563eb',
  teleAppo: '#7c3aed',
  meeting: '#db2777',
  reception: '#0d9488',
  quote: '#d97706',
  closedWon: '#059669',
  funnelApproachToMeeting: '#2563eb',
  funnelMeetingToQuote: '#7c3aed',
  funnelQuoteToWin: '#db2777',
  funnelApproachToWin: '#059669',
  chartGrid: '#e5e7eb',
}

export const CHART_COLOR_KEYS = [
  'coldVisit',
  'teleAppo',
  'meeting',
  'reception',
  'quote',
  'closedWon',
  'funnelApproachToMeeting',
  'funnelMeetingToQuote',
  'funnelQuoteToWin',
  'funnelApproachToWin',
  'chartGrid',
] as const satisfies readonly (keyof ChartColorPalette)[]

export const CHART_COLOR_LABELS: Record<keyof ChartColorPalette, string> = {
  coldVisit: '飛び込み（件数・棒）',
  teleAppo: 'テレアポ（件数・棒）',
  meeting: '商談（件数・棒）',
  reception: '接待（件数・棒）',
  quote: '見積もり（推移・率・棒）',
  closedWon: '受注（推移・率・棒）',
  funnelApproachToMeeting: '転換率：アプローチ→商談',
  funnelMeetingToQuote: '転換率：商談→見積',
  funnelQuoteToWin: '転換率：見積→受注',
  funnelApproachToWin: '転換率：アプローチ→受注',
  chartGrid: 'グラフのグリッド線',
}

export function normalizeHex(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback
  const s = input.trim()
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return '#' + s.slice(1).toLowerCase()
  if (/^[0-9A-Fa-f]{6}$/i.test(s)) return '#' + s.toLowerCase()
  return fallback
}

export function mergeChartColors(input: unknown): ChartColorPalette {
  const out: ChartColorPalette = { ...DEFAULT_CHART_COLORS }
  if (!input || typeof input !== 'object') return out
  const o = input as Record<string, unknown>
  for (const k of CHART_COLOR_KEYS) {
    if (k in o) out[k] = normalizeHex(o[k], DEFAULT_CHART_COLORS[k])
  }
  return out
}
