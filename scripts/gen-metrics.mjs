import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'attendance',
  'metrics.ts',
)

const src = `import type { AttendanceDayRecord } from '../types'
import {
  AUTO_BREAK_MINUTES,
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

export function workMinutes(
  record: AttendanceDayRecord,
  asOfMs: number = Date.now(),
): number {
  return Math.max(0, grossMinutes(record, asOfMs) - AUTO_BREAK_MINUTES)
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
  if (h <= 0) return \`\${m}\u5206\`
  if (m === 0) return \`\${h}\u6642\u9593\`
  return \`\${h}\u6642\u9593\${m}\u5206\`
}

export function formatHoursFloorFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return \`\${h}\u6642\u9593\`
}

export function weekStartMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  const diff = day === 0 ? 6 : day - 1
  dt.setDate(dt.getDate() - diff)
  return \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}-\${String(dt.getDate()).padStart(2, '0')}\`
}

export function weekEndSunday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 6)
  return \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}-\${String(dt.getDate()).padStart(2, '0')}\`
}

export function isDateInWeek(isoDate: string, weekStart: string): boolean {
  const end = weekEndSunday(weekStart)
  return isoDate >= weekStart && isoDate <= end
}

export type UserWeekAttendanceSummary = {
  appUserId: string
  workMinutes: number
  overtimeMinutesTotal: number
  overtimeHoursFloor: number
  overtimeMinutesApproved: number
  overtimeHoursApproved: number
  overtimeMinutesPending: number
  overtimeHoursPending: number
  weeklyExcessMinutes: number
  weeklyExcessHoursFloor: number
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
  return {
    appUserId,
    workMinutes: workMinutesSum,
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
`

fs.writeFileSync(out, src, 'utf8')
const check = fs.readFileSync(out, 'utf8')
console.log('formatMinutesJa(0):', check.includes('${m}\\u5206') || check.includes('?'))
console.log('sample run:', check.match(/formatMinutesJa[\s\S]{0,200}/)?.[0])
