import { createId } from '../createId'
import { todayIsoDate } from '../dates'
import type { AttendanceOvertimeRequest, User } from '../types'

export function sampleOvertimeRequests(
  users: User[],
  adminLabel: string,
): AttendanceOvertimeRequest[] {
  const today = todayIsoDate()
  const yamada = users.find((u) => u.name.includes('\u5c71\u7530'))?.id
  const sato = users.find((u) => u.name === '\u4f50\u85e4')?.id
  const rows: AttendanceOvertimeRequest[] = []
  const add = (r: AttendanceOvertimeRequest | undefined) => {
    if (r) rows.push(r)
  }
  if (sato) {
    add({
      id: createId(),
      appUserId: sato,
      workDate: today,
      plannedHours: 2,
      reason: '\u5ba2\u5148\u7d0d\u54c1\u306e\u305f\u3081',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      approvedByLabel: null,
    })
  }
  if (yamada) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    add({
      id: createId(),
      appUserId: yamada,
      workDate: `${y}-${m}-${day}`,
      plannedHours: 1,
      reason: '\u7d0d\u671f\u5bfe\u5fdc',
      status: 'approved',
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedByLabel: adminLabel,
    })
  }
  return rows
}
