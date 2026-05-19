import { calendarDayDiff, todayIsoDate } from '../dates'

/** \u7de0\u3081\u65e5\u306e\u5c5e\u3059\u308b\u5e74\u6708 YYYY-MM\uff0820\u65e5\u304c\u5c5e\u3059\u6708\uff09\u304b\u3089 21\u65e5\u301c\u6b21\u670820\u65e5\u306e\u7bc4\u56f2 */
export function payPeriodRangeFromEndYm(endYm: string): {
  start: string
  end: string
} | null {
  if (!/^\d{4}-\d{2}$/.test(endYm)) return null
  const [y, m] = endYm.split('-').map(Number) as [number, number, number]
  const end = new Date(y, m - 1, 20)
  const start = new Date(y, m - 2, 21)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

/** \u6307\u5b9a\u65e5\u304c\u5c5e\u3059\u7de0\u3081\u6708\uff08\u7d42\u4e86\u65e5\u306e YYYY-MM\uff09 */
export function payPeriodEndYmForDate(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  if (d >= 21) {
    const next = new Date(y, m, 20)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

export function currentPayPeriodEndYm(ref: string = todayIsoDate()): string {
  return payPeriodEndYmForDate(ref) ?? ref.slice(0, 7)
}

export function shiftPayPeriodEndYm(endYm: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(endYm)) return endYm
  const [y, m] = endYm.split('-').map(Number) as [number, number, number]
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function payPeriodLabel(endYm: string): string {
  const range = payPeriodRangeFromEndYm(endYm)
  if (!range) return endYm
  const [ey, em] = endYm.split('-').map(Number)
  return `${ey}\u5e74${em}\u6708\u7de0\u3081\uff08${range.start.slice(5).replace('-', '/')} \u301c ${range.end.slice(5).replace('-', '/')}\uff09`
}

export function listDatesInRange(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return []
  }
  const days = calendarDayDiff(start, end)
  if (!Number.isFinite(days) || days < 0) return []
  const out: string[] = []
  const [y, m, d] = start.split('-').map(Number) as [number, number, number]
  const cur = new Date(y, m - 1, d)
  for (let i = 0; i <= days; i++) {
    const dt = new Date(cur)
    dt.setDate(cur.getDate() + i)
    out.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    )
  }
  return out
}

export function isDateInPayPeriod(
  workDate: string,
  endYm: string,
): boolean {
  const range = payPeriodRangeFromEndYm(endYm)
  if (!range) return false
  return workDate >= range.start && workDate <= range.end
}
