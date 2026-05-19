/** \u6240\u5b9a\u4f11\u61a9\u67a0\uff0810:00\u301c10:30\u300112:00\u301c13:00\u300115:30\u301c16:00\u3001\u8a082\u6642\u9593\uff09 */
export const SCHEDULED_BREAK_WINDOWS = [
  { startHour: 10, startMinute: 0, endHour: 10, endMinute: 30 },
  { startHour: 12, startMinute: 0, endHour: 13, endMinute: 0 },
  { startHour: 15, startMinute: 30, endHour: 16, endMinute: 0 },
] as const

/** \u5168\u67a0\u3092\u901a\u3057\u3066\u52e4\u52d9\u3057\u305f\u5834\u5408\u306e\u4f11\u61a9\u5408\u8a08\uff08\u5206\uff09 */
export const SCHEDULED_BREAK_MINUTES_MAX = 120

function localDateAt(
  workDate: string,
  hour: number,
  minute: number,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return null
  const [y, m, d] = workDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, hour, minute, 0, 0)
}

/** \u51fa\u52e4\u301c\u9000\u52e4\u3068\u4f11\u61a9\u67a0\u306e\u91cd\u306a\u308a\uff08\u5206\uff09 */
export function breakMinutesInWorkSpan(
  workDate: string,
  clockInIso: string,
  clockOutIso: string,
): number {
  const workStart = Date.parse(clockInIso)
  const workEnd = Date.parse(clockOutIso)
  if (!Number.isFinite(workStart) || !Number.isFinite(workEnd) || workEnd <= workStart) {
    return 0
  }
  let total = 0
  for (const w of SCHEDULED_BREAK_WINDOWS) {
    const bStart = localDateAt(workDate, w.startHour, w.startMinute)
    const bEnd = localDateAt(workDate, w.endHour, w.endMinute)
    if (!bStart || !bEnd) continue
    const overlapStart = Math.max(workStart, bStart.getTime())
    const overlapEnd = Math.min(workEnd, bEnd.getTime())
    if (overlapEnd > overlapStart) {
      total += Math.round((overlapEnd - overlapStart) / 60000)
    }
  }
  return total
}
