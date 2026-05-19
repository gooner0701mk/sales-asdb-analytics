import type { AttendanceOvertimeRequest } from '../types'

function weekEndSunday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 6)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function isDateInWeek(isoDate: string, weekStart: string): boolean {
  const end = weekEndSunday(weekStart)
  return isoDate >= weekStart && isoDate <= end
}

export type OvertimeRequestStatus = AttendanceOvertimeRequest['status']

const REQUEST_STATUSES: readonly OvertimeRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
]

function parseRequestStatus(raw: unknown): OvertimeRequestStatus {
  if (
    typeof raw === 'string' &&
    (REQUEST_STATUSES as readonly string[]).includes(raw)
  ) {
    return raw as OvertimeRequestStatus
  }
  return 'pending'
}

export function normalizeOvertimeRequest(
  x: unknown,
  validUserIds: Set<string>,
): AttendanceOvertimeRequest | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const appUserId = typeof o.appUserId === 'string' ? o.appUserId.trim() : ''
  const workDate = typeof o.workDate === 'string' ? o.workDate.trim() : ''
  if (!id || !appUserId || !validUserIds.has(appUserId)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null
  const plannedRaw =
    typeof o.plannedHours === 'number'
      ? o.plannedHours
      : Number.parseInt(String(o.plannedHours ?? ''), 10)
  const plannedHours = Math.max(1, Math.min(24, Math.round(plannedRaw)))
  const reason = typeof o.reason === 'string' ? o.reason.trim() : ''
  if (!reason) return null
  const requestedAt =
    typeof o.requestedAt === 'string' && o.requestedAt.trim()
      ? o.requestedAt.trim()
      : new Date().toISOString()
  return {
    id,
    appUserId,
    workDate,
    plannedHours,
    reason,
    status: parseRequestStatus(o.status),
    requestedAt,
    approvedAt:
      typeof o.approvedAt === 'string' && o.approvedAt.trim()
        ? o.approvedAt.trim()
        : null,
    approvedByLabel:
      typeof o.approvedByLabel === 'string' && o.approvedByLabel.trim()
        ? o.approvedByLabel.trim()
        : null,
  }
}

export function parseOvertimeRequests(
  raw: unknown,
  validUserIds: Set<string>,
): AttendanceOvertimeRequest[] {
  if (!Array.isArray(raw)) return []
  const out: AttendanceOvertimeRequest[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    const row = normalizeOvertimeRequest(x, validUserIds)
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export function findOvertimeRequestForDay(
  requests: AttendanceOvertimeRequest[],
  appUserId: string,
  workDate: string,
): AttendanceOvertimeRequest | null {
  return (
    requests.find(
      (r) =>
        r.appUserId === appUserId &&
        r.workDate === workDate &&
        (r.status === 'pending' || r.status === 'approved'),
    ) ?? null
  )
}

export function plannedHoursInWeek(
  requests: AttendanceOvertimeRequest[],
  appUserId: string,
  weekStart: string,
  status: 'approved' | 'pending',
): number {
  let h = 0
  for (const r of requests) {
    if (r.appUserId !== appUserId || r.status !== status) continue
    if (!isDateInWeek(r.workDate, weekStart)) continue
    h += r.plannedHours
  }
  return h
}
