import type { MonthlyRecord } from './types'

export function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

export function formatYmJa(ym: string): string {
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return `${y}年${Number(m)}月`
}

export type Totals = {
  coldVisits: number
  teleAppo: number
  meetings: number
  receptions: number
  quotes: number
  closedWon: number
}

export function sumTotals(rows: MonthlyRecord[]): Totals {
  return rows.reduce(
    (acc, r) => ({
      coldVisits: acc.coldVisits + r.coldVisits,
      teleAppo: acc.teleAppo + r.teleAppo,
      meetings: acc.meetings + r.meetings,
      receptions: acc.receptions + r.receptions,
      quotes: acc.quotes + r.quotes,
      closedWon: acc.closedWon + r.closedWon,
    }),
    {
      coldVisits: 0,
      teleAppo: 0,
      meetings: 0,
      receptions: 0,
      quotes: 0,
      closedWon: 0,
    },
  )
}

type SalesActivityCounts = Pick<
  Totals,
  'coldVisits' | 'teleAppo' | 'meetings' | 'receptions'
>

/** 営業件数（飛び込み＋テレアポ＋商談＋接待の回数合計） */
export function totalSalesActivities(t: SalesActivityCounts): number {
  return t.coldVisits + t.teleAppo + t.meetings + t.receptions
}

/** アプローチ件数（飛び込み＋テレアポ） */
export function totalApproaches(t: Totals): number {
  return t.coldVisits + t.teleAppo
}

/** 営業件数に対する見積もり件数率（％）。見積が活動を上回ると100超になり得る */
export function quotesPerSalesActivityRate(t: Totals): number {
  return pct(t.quotes, totalSalesActivities(t))
}

/** 見積もり件数に対する受注率（％） */
export function ordersPerQuoteRate(t: Totals): number {
  return pct(t.closedWon, t.quotes)
}

function chartRowLabel(r: MonthlyRecord & { chartLabel?: string }): string {
  if (r.chartLabel) return r.chartLabel
  if (r.ym === 'total') return '全期間'
  return formatYmJa(r.ym)
}

export function chartRows(rows: (MonthlyRecord & { chartLabel?: string })[]) {
  const sorted = [...rows].sort((a, b) => a.ym.localeCompare(b.ym))
  return sorted.map((r) => {
    const ap = r.coldVisits + r.teleAppo
    const sales = totalSalesActivities(r)
    return {
      ...r,
      label: chartRowLabel(r),
      approaches: ap,
      approachToMeeting: pct(r.meetings, ap),
      meetingToQuote: pct(r.quotes, r.meetings),
      quoteToWin: pct(r.closedWon, r.quotes),
      approachToWin: pct(r.closedWon, ap),
      quotesPerSalesRate: pct(r.quotes, sales),
      orderPerQuoteRate: pct(r.closedWon, r.quotes),
    }
  })
}

export function periodFunnel(totals: Totals) {
  const ap = totalApproaches(totals)
  const sales = totalSalesActivities(totals)
  return {
    approachToMeeting: pct(totals.meetings, ap),
    meetingToQuote: pct(totals.quotes, totals.meetings),
    quoteToWin: pct(totals.closedWon, totals.quotes),
    approachToWin: pct(totals.closedWon, ap),
    quotesPerSalesRate: pct(totals.quotes, sales),
    orderPerQuoteRate: pct(totals.closedWon, totals.quotes),
  }
}
