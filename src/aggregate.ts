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

function emptyActivityCounts(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]))
}

/** 活動ログを月ごとに件数集計（グラフ・カード用） */
export function aggregateByMonth(
  activities: ActivityLog[],
  activityTypeIds: string[],
): MonthlyRecord[] {
  const map = new Map<string, MonthlyRecord>()
  const idSet = new Set(activityTypeIds)

  for (const a of activities) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) continue
    const ym = a.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(ym)) continue

    let row = map.get(ym)
    if (!row) {
      row = {
        id: `agg-${ym}`,
        ym,
        activityCounts: emptyActivityCounts(activityTypeIds),
        quotes: 0,
        closedWon: 0,
      }
      map.set(ym, row)
    }

    if (idSet.has(a.activityType)) {
      row.activityCounts[a.activityType] =
        (row.activityCounts[a.activityType] ?? 0) + 1
    }

    row.quotes += a.quoteCount
    row.closedWon += a.orderCount
  }

  return [...map.values()].sort((a, b) => a.ym.localeCompare(b.ym))
}
