import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '..', 'src', 'AttendanceTab.tsx')

const content = `import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { captureGps, formatGps } from './attendance/geo'
import {
  formatHoursFloorFromMinutes,
  formatMinutesJa,
  overtimeHoursFloor,
  overtimeMinutes,
  summarizeUserWeek,
  weekEndSunday,
  weekStartMonday,
  workMinutes,
} from './attendance/metrics'
import { createId } from './createId'
import { formatDateJa, todayIsoDate } from './dates'
import { useMediaQuery } from './useMediaQuery'
import type {
  AppState,
  AttendanceDayRecord,
  AttendanceOvertimeStatus,
  User,
} from './types'
import './AttendanceTab.css'

type Props = {
  users: User[]
  sessionUserId: string | null
  attendanceRecords: AttendanceDayRecord[]
  attendanceAdminUserIds: string[]
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
}

function userName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? '\u4e0d\u660e'
}

function formatClock(iso: string | null): string {
  if (!iso) return '\u2015'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '\u2015'
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(s: AttendanceOvertimeStatus): string {
  switch (s) {
    case 'pending':
      return '\u6b8b\u696d\u7533\u8acb\u4e2d'
    case 'approved':
      return '\u6b8b\u696d\u627f\u8a8d\u6e08'
    case 'rejected':
      return '\u5374\u4e0b'
    default:
      return ''
  }
}

export function AttendanceTab({
  users,
  sessionUserId,
  attendanceRecords,
  attendanceAdminUserIds,
  setState,
  showToast,
}: Props) {
  const narrow = useMediaQuery('(max-width: 960px)')
  const today = todayIsoDate()
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(today))
  const [gpsBusy, setGpsBusy] = useState(false)

  const isAdmin =
    sessionUserId != null && attendanceAdminUserIds.includes(sessionUserId)

  const openToday = useMemo(() => {
    if (!sessionUserId) return null
    return (
      attendanceRecords.find(
        (r) =>
          r.appUserId === sessionUserId &&
          r.workDate === today &&
          r.clockOutAt === null,
      ) ?? null
    )
  }, [attendanceRecords, sessionUserId, today])

  const todayClosed = useMemo(() => {
    if (!sessionUserId) return null
    return (
      attendanceRecords.find(
        (r) =>
          r.appUserId === sessionUserId &&
          r.workDate === today &&
          r.clockOutAt !== null,
      ) ?? null
    )
  }, [attendanceRecords, sessionUserId, today])

  const myWeek = useMemo(() => {
    if (!sessionUserId) return null
    return summarizeUserWeek(attendanceRecords, sessionUserId, weekStart)
  }, [attendanceRecords, sessionUserId, weekStart])

  const teamWeek = useMemo(
    () =>
      users.map((u) =>
        summarizeUserWeek(attendanceRecords, u.id, weekStart),
      ),
    [users, attendanceRecords, weekStart],
  )

  const pendingApprovals = useMemo(
    () =>
      attendanceRecords
        .filter((r) => r.overtimeStatus === 'pending' && r.clockOutAt)
        .sort((a, b) => (b.clockOutAt ?? '').localeCompare(a.clockOutAt ?? '')),
    [attendanceRecords],
  )

  const punchIn = useCallback(async () => {
    if (!sessionUserId) {
      showToast('\u5148\u306b\u300c\u8a18\u9332\u3059\u308b\u62c5\u5f53\u300d\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\uff08\u5206\u6790\u30bf\u30d6\u4e0a\u90e8\uff09')
      return
    }
    if (openToday) {
      showToast('\u3059\u3067\u306b\u51fa\u52e4\u6253\u523b\u6e08\u307f\u3067\u3059')
      return
    }
    if (todayClosed) {
      showToast('\u672c\u65e5\u306f\u9000\u52e4\u6e08\u307f\u3067\u3059')
      return
    }
    setGpsBusy(true)
    try {
      const gps = await captureGps()
      const now = new Date().toISOString()
      const row: AttendanceDayRecord = {
        id: createId(),
        appUserId: sessionUserId,
        workDate: today,
        clockInAt: now,
        clockOutAt: null,
        clockInLat: gps.lat,
        clockInLng: gps.lng,
        clockOutLat: null,
        clockOutLng: null,
        overtimeStatus: 'none',
        approvedAt: null,
        approvedByLabel: null,
        note: null,
      }
      setState((prev) => ({
        ...prev,
        attendanceRecords: [...prev.attendanceRecords, row],
      }))
      showToast('\u51fa\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '\u51fa\u52e4\u306b\u5931\u6557\u3057\u307e\u3057\u305f')
    } finally {
      setGpsBusy(false)
    }
  }, [sessionUserId, openToday, todayClosed, today, setState, showToast])

  const punchOut = useCallback(async () => {
    if (!sessionUserId || !openToday) {
      showToast('\u51fa\u52e4\u6253\u523b\u304c\u3042\u308a\u307e\u305b\u3093')
      return
    }
    setGpsBusy(true)
    try {
      const gps = await captureGps()
      const now = new Date().toISOString()
      const draft: AttendanceDayRecord = {
        ...openToday,
        clockOutAt: now,
        clockOutLat: gps.lat,
        clockOutLng: gps.lng,
        overtimeStatus: 'none',
      }
      const ot = overtimeMinutes(draft)
      const overtimeStatus: AttendanceOvertimeStatus =
        ot > 0 ? 'pending' : 'none'
      setState((prev) => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map((r) =>
          r.id === openToday.id
            ? {
                ...r,
                clockOutAt: now,
                clockOutLat: gps.lat,
                clockOutLng: gps.lng,
                overtimeStatus,
                approvedAt: null,
                approvedByLabel: null,
              }
            : r,
        ),
      }))
      if (ot > 0) {
        showToast(
          \`\u9000\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f\uff08\u6b8b\u696d \${formatHoursFloorFromMinutes(ot)}\u30fb\u627f\u8a8d\u5f85\u3061\uff09\`,
        )
      } else {
        showToast('\u9000\u52e4\u3092\u8a18\u9332\u3057\u307e\u3057\u305f')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '\u9000\u52e4\u306b\u5931\u6557\u3057\u307e\u3057\u305f')
    } finally {
      setGpsBusy(false)
    }
  }, [sessionUserId, openToday, setState, showToast])

  const setApproval = useCallback(
    (id: string, decision: 'approved' | 'rejected') => {
      if (!isAdmin || !sessionUserId) {
        showToast('\u52e4\u6020\u7ba1\u7406\u8005\u306e\u307f\u627f\u8a8d\u3067\u304d\u307e\u3059\uff08\u8a2d\u5b9a\u30bf\u30d6\u3067\u6307\u5b9a\uff09')
        return
      }
      const adminName = userName(users, sessionUserId)
      const now = new Date().toISOString()
      setState((prev) => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map((r) =>
          r.id === id
            ? {
                ...r,
                overtimeStatus: decision,
                approvedAt: decision === 'approved' ? now : null,
                approvedByLabel: decision === 'approved' ? adminName : null,
              }
            : r,
        ),
      }))
      showToast(
        decision === 'approved' ? '\u6b8b\u696d\u3092\u627f\u8a8d\u3057\u307e\u3057\u305f' : '\u6b8b\u696d\u7533\u8acb\u3092\u5374\u4e0b\u3057\u307e\u3057\u305f',
      )
    },
    [isAdmin, users, sessionUserId, setState, showToast],
  )

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    const next = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`
    setWeekStart(weekStartMonday(next))
  }

  const onDuty = openToday !== null
  const dutyLabel = !sessionUserId
    ? '\u62c5\u5f53\u672a\u9078\u629e'
    : onDuty
      ? '\u52e4\u52d9\u4e2d'
      : todayClosed
        ? '\u672c\u65e5\u9000\u52e4\u6e08\u307f'
        : '\u672a\u51fa\u52e4'

  return (
    <motion className="attendance-tab">
`

fs.writeFileSync(out, content, 'utf8')
console.log('partial write - need part 2')
