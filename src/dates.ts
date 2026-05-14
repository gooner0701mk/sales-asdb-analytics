/** 今日（ローカル日付）から見た経過日数。同日なら 0。未来日は負数。 */
export function daysElapsedSince(isoDate: string | null): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const base = new Date(y, m - 1, d)
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = t0.getTime() - base.getTime()
  return Math.round(diffMs / 86400000)
}

export function todayIsoDate(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** `YYYY-MM` を delta ヶ月シフト（暦）。不正な ym はそのまま返す。 */
export function addCalendarMonthsYm(ym: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [ys, ms] = ym.split('-').map(Number) as [number, number]
  const d = new Date(ys, ms - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * ローカルの「今日の暦日」から n 日前（0 = 今日）。
 * setHours + setDate ではなく年月日だけで加減し、月のまたぎで意図しない日付にならないようにする。
 */
export function isoDaysAgo(daysAgo: number): string {
  const n = new Date()
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() - daysAgo)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export function formatDateJa(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '―'
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

/** 画面表示用。同日は「今日」。未来日は「あとN日」。 */
export function formatElapsedLabel(days: number | null): string {
  if (days === null) return '―'
  if (days === 0) return '今日'
  if (days > 0) return `経過 ${days} 日`
  return `あと ${-days} 日（未来の日付）`
}

/**
 * 暦日 fromIso から toIso までの日数（to − from、ローカル暦の 0 時同士）。
 * 両方 YYYY-MM-DD。不正なら NaN。
 */
export function calendarDayDiff(fromIso: string, toIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso)) {
    return NaN
  }
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return new Date(y, m - 1, d).getTime()
  }
  return Math.round((t(toIso) - t(fromIso)) / 86400000)
}
