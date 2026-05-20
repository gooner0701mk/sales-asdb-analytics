import type { AttendanceDayRecord } from '../types'

export type TodayWorkKind = 'in' | 'out' | 'none'

/** 同一勤務日に複数行ある場合は、未退勤を優先し、退勤済みは最新の退勤時刻を採用 */
export function resolveTodayWorkStatus(
  records: AttendanceDayRecord[],
  appUserId: string,
  workDate: string,
):
  | { kind: 'in'; row: AttendanceDayRecord }
  | { kind: 'out'; row: AttendanceDayRecord }
  | { kind: 'none' } {
  const dayRows = records.filter(
    (r) => r.appUserId === appUserId && r.workDate === workDate,
  )
  const open = dayRows.find((r) => Boolean(r.clockInAt) && r.clockOutAt === null)
  if (open) return { kind: 'in', row: open }
  const withOut = dayRows.filter((r) => r.clockOutAt)
  if (withOut.length > 0) {
    const row = [...withOut].sort((a, b) =>
      (b.clockOutAt ?? '').localeCompare(a.clockOutAt ?? ''),
    )[0]!
    return { kind: 'out', row }
  }
  return { kind: 'none' }
}
