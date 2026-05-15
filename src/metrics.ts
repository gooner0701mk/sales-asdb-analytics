import type { ActivityTypeCatalogItem, MonthlyRecord } from './types'

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
  activityCounts: Record<string, number>
  quotes: number
  closedWon: number
}

export function sumTotals(rows: MonthlyRecord[]): Totals {
  const activityCounts: Record<string, number> = {}
  let quotes = 0
  let closedWon = 0
  for (const r of rows) {
    quotes += r.quotes
    closedWon += r.closedWon
    for (const [k, v] of Object.entries(r.activityCounts)) {
      activityCounts[k] = (activityCounts[k] ?? 0) + v
    }
  }
  return { activityCounts, quotes, closedWon }
}

function countByRole(
  t: Totals,
  catalog: ActivityTypeCatalogItem[],
  role: ActivityTypeCatalogItem['role'],
): number {
  return catalog
    .filter((c) => c.role === role)
    .reduce((s, c) => s + (t.activityCounts[c.id] ?? 0), 0)
}

/** 営業件数（カタログに列挙された種類の合計） */
export function totalSalesActivities(
  t: Totals,
  catalog: ActivityTypeCatalogItem[],
): number {
  return catalog.reduce((s, c) => s + (t.activityCounts[c.id] ?? 0), 0)
}

/** アプローチ件数（role が approach の種類の合計） */
export function totalApproaches(
  t: Totals,
  catalog: ActivityTypeCatalogItem[],
): number {
  return countByRole(t, catalog, 'approach')
}

/** 商談相当の件数（role が meeting） */
export function meetingActivityCount(
  t: Totals,
  catalog: ActivityTypeCatalogItem[],
): number {
  return countByRole(t, catalog, 'meeting')
}

/** 営業件数に対する見積もり件数率（％）。見積が活動を上回ると100超え得る */
export function quotesPerSalesActivityRate(
  t: Totals,
  catalog: ActivityTypeCatalogItem[],
): number {
  return pct(t.quotes, totalSalesActivities(t, catalog))
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

function sumRoleRow(
  r: MonthlyRecord,
  catalog: ActivityTypeCatalogItem[],
  role: ActivityTypeCatalogItem['role'],
): number {
  return catalog
    .filter((c) => c.role === role)
    .reduce((s, c) => s + (r.activityCounts[c.id] ?? 0), 0)
}

function totalSalesRow(r: MonthlyRecord, catalog: ActivityTypeCatalogItem[]): number {
  return catalog.reduce((s, c) => s + (r.activityCounts[c.id] ?? 0), 0)
}

export function chartRows(
  rows: (MonthlyRecord & { chartLabel?: string })[],
  catalog: ActivityTypeCatalogItem[],
) {
  const ids = catalog.map((c) => c.id)
  const sorted = [...rows].sort((a, b) => a.ym.localeCompare(b.ym))
  return sorted.map((r) => {
    const flat = Object.fromEntries(
      ids.map((id) => [id, r.activityCounts[id] ?? 0]),
    ) as Record<string, number>
    const ap = sumRoleRow(r, catalog, 'approach')
    const meet = sumRoleRow(r, catalog, 'meeting')
    const sales = totalSalesRow(r, catalog)
    return {
      ...flat,
      quotes: r.quotes,
      closedWon: r.closedWon,
      label: chartRowLabel(r),
      approaches: ap,
      approachToMeeting: pct(meet, ap),
      meetingToQuote: pct(r.quotes, meet),
      quoteToWin: pct(r.closedWon, r.quotes),
      approachToWin: pct(r.closedWon, ap),
      quotesPerSalesRate: pct(r.quotes, sales),
      orderPerQuoteRate: pct(r.closedWon, r.quotes),
    }
  })
}

export function periodFunnel(
  totals: Totals,
  catalog: ActivityTypeCatalogItem[],
) {
  const ap = totalApproaches(totals, catalog)
  const meet = meetingActivityCount(totals, catalog)
  const sales = totalSalesActivities(totals, catalog)
  return {
    approachToMeeting: pct(meet, ap),
    meetingToQuote: pct(totals.quotes, meet),
    quoteToWin: pct(totals.closedWon, totals.quotes),
    approachToWin: pct(totals.closedWon, ap),
    quotesPerSalesRate: pct(totals.quotes, sales),
    orderPerQuoteRate: pct(totals.closedWon, totals.quotes),
  }
}

/** アプローチ件数（飛び込み＋テレアポ相当）— 月次行用 */
export function totalApproachesRow(
  r: MonthlyRecord,
  catalog: ActivityTypeCatalogItem[],
): number {
  return sumRoleRow(r, catalog, 'approach')
}
