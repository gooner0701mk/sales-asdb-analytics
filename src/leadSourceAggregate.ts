import type { ActivityLog, SelectOptionItem } from './types'
import { fyStartYearFromCalendarYm } from './fiscalYear'
import type { PeriodGroupMode } from './periodGroup'

export type LeadSourceAggRow = {
  key: string
  label: string
  activityCount: number
  /** 見積もり件数の合計（活動ごとの quoteCount を加算） */
  quoteSum: number
  /** 見積もりが1件以上ある活動の件数 */
  activitiesWithQuote: number
}

/** 期間内の活動を流入経路ごとに集計（カタログの順＋末尾に流入未設定） */
export function aggregateByLeadSource(
  activities: ActivityLog[],
  catalog: SelectOptionItem[],
): LeadSourceAggRow[] {
  const map = new Map<string, LeadSourceAggRow>()
  for (const { id, label } of catalog) {
    map.set(id, {
      key: id,
      label,
      activityCount: 0,
      quoteSum: 0,
      activitiesWithQuote: 0,
    })
  }
  map.set('unset', {
    key: 'unset',
    label: '流入未設定',
    activityCount: 0,
    quoteSum: 0,
    activitiesWithQuote: 0,
  })

  const unset = map.get('unset')!

  for (const a of activities) {
    const key =
      a.leadSource != null && a.leadSource !== '' && map.has(a.leadSource)
        ? a.leadSource
        : 'unset'
    const row = key === 'unset' ? unset : map.get(key)!
    row.activityCount += 1
    row.quoteSum += a.quoteCount
    if (a.quoteCount > 0) row.activitiesWithQuote += 1
  }

  const out: LeadSourceAggRow[] = []
  for (const { id } of catalog) {
    const row = map.get(id)
    if (row) out.push(row)
  }
  out.push(unset)
  return out
}

/** 活動件数が1件以上ある経路だけ（グラフ用） */
export function rowsWithLeadData(rows: LeadSourceAggRow[]): LeadSourceAggRow[] {
  return rows.filter((r) => r.activityCount > 0)
}

/** カード集計と同じ期間で活動を絞る（活動日の暦月／指定会計年度／全期間） */
export function filterActivitiesByPeriodScope(
  activities: ActivityLog[],
  periodGroup: PeriodGroupMode,
  focusMonthYm: string,
  /** `todayIsoDate()` と同じローカル暦の YYYY-MM-DD（呼び出し互換のため残す） */
  _todayYmd: string,
  fiscalYearStartMonth: number,
  /** 年次モードで参照する会計年度の開始年 */
  fiscalFocusStartYear: number,
): ActivityLog[] {
  return activities.filter((a) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) return false
    const ym = a.date.slice(0, 7)
    if (periodGroup === 'all') return true
    if (periodGroup === 'month') return ym === focusMonthYm
    if (periodGroup === 'fiscalYearMarch') {
      return (
        fyStartYearFromCalendarYm(ym, fiscalYearStartMonth) ===
        fiscalFocusStartYear
      )
    }
    return true
  })
}
