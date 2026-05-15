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

function mergeActivityCounts(
  a: Record<string, number>,
  b: Record<string, number>,
  ids: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of ids) {
    out[id] = (a[id] ?? 0) + (b[id] ?? 0)
  }
  return out
}

function emptyActivityCounts(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]))
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
  activityTypeIds: string[],
): BucketMonthlyRecord[] {
  const sorted = [...months].sort((a, b) => a.ym.localeCompare(b.ym))
  if (sorted.length === 0) return []

  const zero = () => emptyActivityCounts(activityTypeIds)

  if (mode === 'month') {
    return sorted.map((r) => ({ ...r }))
  }

  if (mode === 'all') {
    const t = sorted.reduce(
      (acc, r) => ({
        activityCounts: mergeActivityCounts(acc.activityCounts, r.activityCounts, activityTypeIds),
        quotes: acc.quotes + r.quotes,
        closedWon: acc.closedWon + r.closedWon,
      }),
      {
        activityCounts: zero(),
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
  const fyMap = new Map<number, BucketMonthlyRecord>()
  for (const r of sorted) {
    const fy = fyStartYearFromCalendarYm(r.ym, sm)
    let row = fyMap.get(fy)
    if (!row) {
      row = {
        id: `fy-${fy}`,
        ym: `${fy}-${String(Math.max(1, Math.min(12, sm))).padStart(2, '0')}`,
        chartLabel: fiscalYearRangeLabel(fy, sm),
        activityCounts: zero(),
        quotes: 0,
        closedWon: 0,
      }
      fyMap.set(fy, row)
    }
    row.activityCounts = mergeActivityCounts(
      row.activityCounts,
      r.activityCounts,
      activityTypeIds,
    )
    row.quotes += r.quotes
    row.closedWon += r.closedWon
  }

  return [...fyMap.entries()]
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
