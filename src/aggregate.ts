import type { ActivityLog, DataViewUserIds, MonthlyRecord } from './types'

/** 表示対象の活動（dataViewUserIds に応じて絞り込み） */
export function filterActivities(
  activities: ActivityLog[],
  dataViewUserIds: DataViewUserIds,
): ActivityLog[] {
  if (dataViewUserIds === 'all') return activities
  if (dataViewUserIds.length === 0) return []
  const set = new Set(dataViewUserIds)
  return activities.filter((a) => set.has(a.userId))
}

/** 活動ログを月ごとに件数集計（グラフ・カード用） */
export function aggregateByMonth(activities: ActivityLog[]): MonthlyRecord[] {
  const map = new Map<string, MonthlyRecord>()

  for (const a of activities) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) continue
    const ym = a.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(ym)) continue

    let row = map.get(ym)
    if (!row) {
      row = {
        id: `agg-${ym}`,
        ym,
        coldVisits: 0,
        teleAppo: 0,
        meetings: 0,
        receptions: 0,
        quotes: 0,
        closedWon: 0,
      }
      map.set(ym, row)
    }

    if (a.activityType === 'coldVisit') row.coldVisits += 1
    else if (a.activityType === 'teleAppo') row.teleAppo += 1
    else if (a.activityType === 'meeting') row.meetings += 1
    else if (a.activityType === 'reception') row.receptions += 1

    row.quotes += a.quoteCount
    row.closedWon += a.orderCount
  }

  return [...map.values()].sort((a, b) => a.ym.localeCompare(b.ym))
}
