import { createId } from '../createId'
import { overtimeMinutes } from './metrics'
import type { AttendanceDayRecord, AttendanceOvertimeStatus } from '../types'

/** ISO ? datetime-local ??????? */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local ? ISO????????????iOS Safari ??? */
export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      m[6] ? Number(m[6]) : 0,
      0,
    )
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  const fallback = new Date(trimmed)
  if (Number.isNaN(fallback.getTime())) return null
  return fallback.toISOString()
}

export function overtimeStatusAfterEdit(
  record: AttendanceDayRecord,
  previous: AttendanceOvertimeStatus,
): AttendanceOvertimeStatus {
  if (!record.clockOutAt) return 'none'
  const ot = overtimeMinutes(record)
  if (ot <= 0) return 'none'
  if (previous === 'approved') return 'approved'
  return 'pending'
}

/** ISO ???????? YYYY-MM-DD */
export function workDateFromIsoLocal(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ???????????????GPS ??? */
export function createManualAttendanceRecord(opts: {
  appUserId: string
  clockInIso: string
  clockOutIso: string | null
}): AttendanceDayRecord | null {
  const workDate = workDateFromIsoLocal(opts.clockInIso)
  if (!workDate) return null
  const base: AttendanceDayRecord = {
    id: createId(),
    appUserId: opts.appUserId,
    workDate,
    clockInAt: opts.clockInIso,
    clockOutAt: opts.clockOutIso,
    clockInLat: 0,
    clockInLng: 0,
    clockOutLat: opts.clockOutIso ? 0 : null,
    clockOutLng: opts.clockOutIso ? 0 : null,
    overtimeStatus: 'none',
    approvedAt: null,
    approvedByLabel: null,
    overtimeReason: null,
    overtimeRequestId: null,
    note: null,
  }
  if (!opts.clockOutIso) return base
  const closed = buildEditedRecord(base, opts.clockInIso, opts.clockOutIso)
  return {
    ...closed,
    overtimeStatus: 'none',
    approvedAt: null,
    approvedByLabel: null,
    overtimeReason: null,
    overtimeRequestId: null,
  }
}

export function buildEditedRecord(
  base: AttendanceDayRecord,
  clockInIso: string,
  clockOutIso: string | null,
): AttendanceDayRecord {
  const next: AttendanceDayRecord = {
    ...base,
    clockInAt: clockInIso,
    clockOutAt: clockOutIso,
    overtimeRequestId: base.overtimeRequestId,
    overtimeStatus: overtimeStatusAfterEdit(
      { ...base, clockInAt: clockInIso, clockOutAt: clockOutIso },
      base.overtimeStatus,
    ),
  }
  if (next.overtimeStatus !== 'approved') {
    next.approvedAt = null
    next.approvedByLabel = null
  }
  if (overtimeMinutes(next) <= 0) {
    next.overtimeReason = null
  }
  return next
}
