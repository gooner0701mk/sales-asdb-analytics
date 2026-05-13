import type { DataViewUserIds, User } from './types'

export function dataViewIsAll(ids: DataViewUserIds): ids is 'all' {
  return ids === 'all'
}

/** 担当者列を出すか（複数担当が混在しうるとき） */
export function dataViewShowsOwnerColumn(ids: DataViewUserIds): boolean {
  return ids === 'all' || ids.length > 1
}

/** マイルストーンを1人分だけ表示するときの userId */
export function dataViewSingleUserId(ids: DataViewUserIds): string | null {
  if (ids === 'all') return null
  if (ids.length === 1) return ids[0] ?? null
  return null
}

export function dataViewSummaryLabel(ids: DataViewUserIds, users: User[]): string {
  if (ids === 'all') return '全員'
  if (ids.length === 0) return 'ユーザーを選択'
  const names = ids
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter((n): n is string => Boolean(n))
  if (names.length === 0) return 'ユーザーを選択'
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} ほか${names.length - 2}名`
}
