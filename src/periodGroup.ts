import type { MonthlyRecord } from './types'
import {
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'

/** グラフ横軸の集計単位 */
export type PeriodGroupMode = 'month' | 'fiscalYearMarch' | 'all'

export type BucketMonthlyRecord = MonthlyRecord & { chartLabel?: string }

/** 互換: 3月始まり年度の開始年 */
export function fyMarchStartYearFromCalendarYm(ym: string): number {
  return fyStartYearFromCalendarYm(ym, 3)
}

/**
 * 月次集計行を、表示単位に応じてまとめ直す。
 * - month: そのまま
 * - fiscalYearMarch: 会計年度（開始月は fiscalYearStartMonth）で合算
 * - all: 全期間を1行
 */
export function rollupPeriodBuckets(
  months: MonthlyRecord[],
  mode: PeriodGroupMode,
  fiscalYearStartMonth: number,
): BucketMonthlyRecord[] {
  const sorted = [...months].sort((a, b) => a.ym.localeCompare(b.ym))
  if (sorted.length === 0) return []

  if (mode === 'month') {
    return sorted.map((r) => ({ ...r }))
  }

  if (mode === 'all') {
    const t = sorted.reduce(
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
    return [
      {
        id: 'all-total',
        ym: 'total',
        chartLabel: '全期間',
        ...t,
      },
    ]
  }

  const sm = fiscalYearStartMonth
  const map = new Map<number, BucketMonthlyRecord>()
  for (const r of sorted) {
    const fy = fyStartYearFromCalendarYm(r.ym, sm)
    let row = map.get(fy)
    if (!row) {
      row = {
        id: `fy-${fy}`,
        ym: `${fy}-${String(Math.max(1, Math.min(12, sm))).padStart(2, '0')}`,
        chartLabel: fiscalYearRangeLabel(fy, sm),
        coldVisits: 0,
        teleAppo: 0,
        meetings: 0,
        receptions: 0,
        quotes: 0,
        closedWon: 0,
      }
      map.set(fy, row)
    }
    row.coldVisits += r.coldVisits
    row.teleAppo += r.teleAppo
    row.meetings += r.meetings
    row.receptions += r.receptions
    row.quotes += r.quotes
    row.closedWon += r.closedWon
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
}

export function periodGroupChartTitleSuffix(
  mode: PeriodGroupMode,
  fiscalYearStartMonth: number,
): string {
  const sm = Math.max(1, Math.min(12, Math.round(fiscalYearStartMonth))) || 3
  switch (mode) {
    case 'month':
      return '月次'
    case 'fiscalYearMarch':
      return `年次（${sm}月始まり）`
    case 'all':
      return '全期間'
    default:
      return ''
  }
}
