import type { AttendanceDayRecord } from '../types'
import { isDateInPayPeriod } from './payPeriod'
import { breakMinutesInWorkSpan } from './breaks'
import {
  MONTHLY_OT_WARNING_REMAINING_MINUTES,
  MONTHLY_OVERTIME_LIMIT_HOURS,
  MONTHLY_OVERTIME_LIMIT_MINUTES,
  STANDARD_WEEKLY_WORK_MINUTES,
  STANDARD_WORK_MINUTES,
} from './constants'

function parseIsoMs(iso: string): number | null {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export function grossMinutes(
  record: AttendanceDayRecord,
  asOfMs: number = Date.now(),
): number {
  const start = parseIsoMs(record.clockInAt)
  if (start === null) return 0
  const end = record.clockOutAt
    ? parseIsoMs(record.clockOutAt)
    : asOfMs
  if (end === null || end < start) return 0
  return Math.round((end - start) / 60000)
}

export function breakMinutes(record: AttendanceDayRecord): number {
  if (!record.clockOutAt) return 0
  return breakMinutesInWorkSpan(
    record.workDate,
    record.clockInAt,
    record.clockOutAt,
  )
}

export function workMinutes(
  record: AttendanceDayRecord,
  asOfMs: number = Date.now(),
): number {
  const gross = grossMinutes(record, asOfMs)
  if (!record.clockOutAt) return Math.max(0, gross)
  const br = breakMinutes(record)
  return Math.max(0, gross - br)
}

export function overtimeMinutes(
  record: AttendanceDayRecord,
  asOfMs: number = Date.now(),
): number {
  return Math.max(0, workMinutes(record, asOfMs) - STANDARD_WORK_MINUTES)
}

export function overtimeHoursFloor(
  record: AttendanceDayRecord,
  asOfMs: number = Date.now(),
): number {
  return Math.floor(overtimeMinutes(record, asOfMs) / 60)
}

export function formatMinutesJa(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}\u5206`
  if (m === 0) return `${h}\u6642\u9593`
  return `${h}\u6642\u9593${m}\u5206`
}

export function formatHoursFloorFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return `${h}\u6642\u9593`
}

export function weekStartMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  const diff = day === 0 ? 6 : day - 1
  dt.setDate(dt.getDate() - diff)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function weekEndSunday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 6)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function isDateInWeek(isoDate: string, weekStart: string): boolean {
  const end = weekEndSunday(weekStart)
  return isoDate >= weekStart && isoDate <= end
}

export type UserWeekAttendanceSummary = {
  appUserId: string
  workMinutes: number
  /** ?40???????????? */
  weeklyRegularRemainingMinutes: number
  weeklyRegularRemainingHoursFloor: number
  overtimeMinutesTotal: number
  overtimeHoursFloor: number
  overtimeMinutesApproved: number
  overtimeHoursApproved: number
  overtimeMinutesPending: number
  overtimeHoursPending: number
  weeklyExcessMinutes: number
  weeklyExcessHoursFloor: number
}

export function calendarMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export type UserMonthOvertimeSummary = {
  appUserId: string
  /** \u7de0\u3081\u6708 YYYY-MM\uff0820\u65e5\u7de0\u3081\uff09 */
  payPeriodEndYm: string
  usedMinutes: number
  usedHoursFloor: number
  remainingMinutes: number
  remainingHoursFloor: number
  isWarning: boolean
  isExceeded: boolean
}

/** \u7de0\u3081\u671f\u9593\uff0821\u65e5\u301c\u6b21\u670820\u65e5\uff09\u306e\u5b9f\u7e3e\u6b8b\u696d\u5408\u8a08 */
export function summarizeUserMonthOvertime(
  records: AttendanceDayRecord[],
  appUserId: string,
  payPeriodEndYm: string,
): UserMonthOvertimeSummary {
  let used = 0
  for (const r of records) {
    if (r.appUserId !== appUserId) continue
    if (!isDateInPayPeriod(r.workDate, payPeriodEndYm)) continue
    if (!r.clockOutAt) continue
    used += overtimeMinutes(r)
  }

  const usedHoursFloor = Math.floor(used / 60)
  const remaining = Math.max(0, MONTHLY_OVERTIME_LIMIT_MINUTES - used)
  /** ?????(h)?????????????????????????? */
  const remainingHoursFloor = Math.max(
    0,
    MONTHLY_OVERTIME_LIMIT_HOURS - usedHoursFloor,
  )
  return {
    appUserId,
    payPeriodEndYm,
    usedMinutes: used,
    usedHoursFloor,
    remainingMinutes: remaining,
    remainingHoursFloor,
    isWarning:
      remaining > 0 && remaining <= MONTHLY_OT_WARNING_REMAINING_MINUTES,
    isExceeded: used >= MONTHLY_OVERTIME_LIMIT_MINUTES,
  }
}

export function summarizeUserWeek(
  records: AttendanceDayRecord[],
  appUserId: string,
  weekStart: string,
  asOfMs: number = Date.now(),
): UserWeekAttendanceSummary {
  const mine = records.filter(
    (r) => r.appUserId === appUserId && isDateInWeek(r.workDate, weekStart),
  )
  let workMinutesSum = 0
  let otTotal = 0
  let otApproved = 0
  let otPending = 0
  for (const r of mine) {
    const wm = workMinutes(r, asOfMs)
    workMinutesSum += wm
    const ot = overtimeMinutes(r, asOfMs)
    if (ot <= 0) continue
    otTotal += ot
    if (r.overtimeStatus === 'approved') otApproved += ot
    else if (r.overtimeStatus === 'pending') otPending += ot
  }
  const weeklyExcess = Math.max(0, workMinutesSum - STANDARD_WEEKLY_WORK_MINUTES)
  const weeklyRegularRemainingMinutes = Math.max(
    0,
    STANDARD_WEEKLY_WORK_MINUTES - workMinutesSum,
  )
  return {
    appUserId,
    workMinutes: workMinutesSum,
    weeklyRegularRemainingMinutes,
    weeklyRegularRemainingHoursFloor: Math.floor(
      weeklyRegularRemainingMinutes / 60,
    ),
    overtimeMinutesTotal: otTotal,
    overtimeHoursFloor: Math.floor(otTotal / 60),
    overtimeMinutesApproved: otApproved,
    overtimeHoursApproved: Math.floor(otApproved / 60),
    overtimeMinutesPending: otPending,
    overtimeHoursPending: Math.floor(otPending / 60),
    weeklyExcessMinutes: weeklyExcess,
    weeklyExcessHoursFloor: Math.floor(weeklyExcess / 60),
  }
}
