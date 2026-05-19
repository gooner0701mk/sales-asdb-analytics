import { breakMinutesInWorkSpan } from './breaks'
import { STANDARD_WORK_MINUTES } from './constants'
import type { AttendanceDayRecord, AttendanceOvertimeStatus } from '../types'

const OT_STATUSES: readonly AttendanceOvertimeStatus[] = [
  'none',
  'pending',
  'approved',
  'rejected',
]

function parseOvertimeStatus(raw: unknown): AttendanceOvertimeStatus {
  if (typeof raw === 'string' && (OT_STATUSES as readonly string[]).includes(raw)) {
    return raw as AttendanceOvertimeStatus
  }
  return 'none'
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function normalizeAttendanceRecord(
  x: unknown,
  validUserIds: Set<string>,
): AttendanceDayRecord | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const appUserId = typeof o.appUserId === 'string' ? o.appUserId.trim() : ''
  const workDate = typeof o.workDate === 'string' ? o.workDate.trim() : ''
  const clockInAt = typeof o.clockInAt === 'string' ? o.clockInAt.trim() : ''
  if (!id || !appUserId || !validUserIds.has(appUserId)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null
  if (!clockInAt || Number.isNaN(Date.parse(clockInAt))) return null
  const lat = parseNum(o.clockInLat)
  const lng = parseNum(o.clockInLng)
  if (lat === null || lng === null) return null
  const clockOutAt =
    typeof o.clockOutAt === 'string' && o.clockOutAt.trim()
      ? o.clockOutAt.trim()
      : null
  const clockOutLat = parseNum(o.clockOutLat)
  const clockOutLng = parseNum(o.clockOutLng)
  let overtimeStatus = parseOvertimeStatus(o.overtimeStatus)
  if (clockOutAt) {
    const gross = (Date.parse(clockOutAt) - Date.parse(clockInAt)) / 60000
    const br = breakMinutesInWorkSpan(workDate, clockInAt, clockOutAt)
    const work = Math.max(0, gross - br)
    const ot = Math.max(0, work - STANDARD_WORK_MINUTES)
    if (ot <= 0) overtimeStatus = 'none'
  } else {
    overtimeStatus = 'none'
  }
  return {
    id,
    appUserId,
    workDate,
    clockInAt,
    clockOutAt,
    clockInLat: lat,
    clockInLng: lng,
    clockOutLat: clockOutAt ? clockOutLat : null,
    clockOutLng: clockOutAt ? clockOutLng : null,
    overtimeStatus,
    approvedAt:
      typeof o.approvedAt === 'string' && o.approvedAt.trim()
        ? o.approvedAt.trim()
        : null,
    approvedByLabel:
      typeof o.approvedByLabel === 'string' && o.approvedByLabel.trim()
        ? o.approvedByLabel.trim()
        : null,
    overtimeReason:
      typeof o.overtimeReason === 'string' && o.overtimeReason.trim()
        ? o.overtimeReason.trim()
        : null,
    overtimeRequestId:
      typeof o.overtimeRequestId === 'string' && o.overtimeRequestId.trim()
        ? o.overtimeRequestId.trim()
        : null,
    note:
      typeof o.note === 'string' && o.note.trim() ? o.note.trim() : null,
  }
}

export function parseAttendanceRecords(
  raw: unknown,
  validUserIds: Set<string>,
): AttendanceDayRecord[] {
  if (!Array.isArray(raw)) return []
  const out: AttendanceDayRecord[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const row = normalizeAttendanceRecord(x, validUserIds)
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export function parseAttendanceAdminUserIds(
  raw: unknown,
  validUserIds: Set<string>,
): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const id = x.trim()
    if (!id || !validUserIds.has(id) || out.includes(id)) continue
    out.push(id)
  }
  return out
}
