import { aggregateByMonth } from './aggregate'
import { aggregateByLeadSource, filterActivitiesByPeriodScope } from './leadSourceAggregate'
import type { PeriodGroupMode } from './periodGroup'
import {
  ordersPerQuoteRate,
  quotesPerSalesActivityRate,
  sumTotals,
  totalSalesActivities,
} from './metrics'
import type { ActivityLog, SelectOptionItem, User } from './types'

export type UserPeriodTotals = {
  userId: string
  displayName: string
  totals: ReturnType<typeof sumTotals>
  /** 期間内の活動ログ件数 */
  activityCount: number
}

/** 画面上部の「表示単位」と同じ期間で、ユーザーごとに活動を集計 */
export function buildUserPeriodTotals(
  users: User[],
  allActivities: ActivityLog[],
  periodGroup: PeriodGroupMode,
  focusMonthYm: string,
  todayYmd: string,
  fiscalYearStartMonth: number,
  fiscalFocusStartYear: number,
): UserPeriodTotals[] {
  return users.map((u) => {
    const mine = allActivities.filter((a) => a.userId === u.id)
    const scoped = filterActivitiesByPeriodScope(
      mine,
      periodGroup,
      focusMonthYm,
      todayYmd,
      fiscalYearStartMonth,
      fiscalFocusStartYear,
    )
    const months = aggregateByMonth(scoped)
    return {
      userId: u.id,
      displayName: u.name,
      totals: sumTotals(months),
      activityCount: scoped.length,
    }
  })
}

export const USER_COMPARE_TABS = [
  { id: 'coldVisit', label: '飛び込み件数', kind: 'count' as const },
  { id: 'teleAppo', label: 'テレアポ件数', kind: 'count' as const },
  { id: 'meeting', label: '商談件数', kind: 'count' as const },
  { id: 'reception', label: '接待件数', kind: 'count' as const },
  { id: 'salesActs', label: '営業件数（計）', kind: 'count' as const },
  { id: 'quotes', label: '見積もり（件数合計）', kind: 'count' as const },
  { id: 'closedWon', label: '受注（件数合計）', kind: 'count' as const },
  { id: 'activityLog', label: '活動ログ件数', kind: 'count' as const },
  { id: 'quotesRate', label: '見積÷営業件数（％）', kind: 'percent' as const },
  { id: 'orderRate', label: '受注÷見積（％）', kind: 'percent' as const },
  { id: 'leadSources', label: '流入経路（内訳・件数）', kind: 'leadStack' as const },
] as const

export type UserCompareTabId = (typeof USER_COMPARE_TABS)[number]['id']

export function tabValueForUser(
  row: UserPeriodTotals,
  tabId: Exclude<UserCompareTabId, 'leadSources'>,
): number {
  switch (tabId) {
    case 'coldVisit':
      return row.totals.coldVisits
    case 'teleAppo':
      return row.totals.teleAppo
    case 'meeting':
      return row.totals.meetings
    case 'reception':
      return row.totals.receptions
    case 'salesActs':
      return totalSalesActivities(row.totals)
    case 'quotes':
      return row.totals.quotes
    case 'closedWon':
      return row.totals.closedWon
    case 'activityLog':
      return row.activityCount
    case 'quotesRate':
      return quotesPerSalesActivityRate(row.totals)
    case 'orderRate':
      return ordersPerQuoteRate(row.totals)
  }
}

export type LeadStackRow = {
  name: string
  userId: string
  [stackKey: string]: string | number
}

export function leadStackKeysFromCatalog(catalog: SelectOptionItem[]): string[] {
  return [...catalog.map((c) => c.id), 'unset']
}

export function leadStackLabel(key: string, catalog: SelectOptionItem[]): string {
  if (key === 'unset') return '流入未設定'
  return catalog.find((c) => c.id === key)?.label ?? key
}

export function buildLeadSourceStackRows(
  users: User[],
  allActivities: ActivityLog[],
  leadCatalog: SelectOptionItem[],
  periodGroup: PeriodGroupMode,
  focusMonthYm: string,
  todayYmd: string,
  fiscalYearStartMonth: number,
  fiscalFocusStartYear: number,
): LeadStackRow[] {
  const keys = leadStackKeysFromCatalog(leadCatalog)
  const zeros = (): Record<string, number> =>
    Object.fromEntries(keys.map((k) => [k, 0]))

  return users.map((u) => {
    const mine = allActivities.filter((a) => a.userId === u.id)
    const scoped = filterActivitiesByPeriodScope(
      mine,
      periodGroup,
      focusMonthYm,
      todayYmd,
      fiscalYearStartMonth,
      fiscalFocusStartYear,
    )
    const counts = zeros()
    const agg = aggregateByLeadSource(scoped, leadCatalog)
    for (const r of agg) {
      if (r.key in counts) counts[r.key] = r.activityCount
    }
    return { name: u.name, userId: u.id, ...counts }
  })
}
