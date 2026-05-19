import { createId } from '../createId'
import { isoDaysAgo } from '../dates'
import type {
  AttendanceDayRecord,
  AttendanceOvertimeStatus,
  User,
} from '../types'

/** ??????????? ISO ??? */
function at(daysAgo: number, hour: number, minute: number): string {
  const [y, m, d] = isoDaysAgo(daysAgo).split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString()
}

const OFFICE_LAT = 35.6812
const OFFICE_LNG = 139.7671

function mk(
  appUserId: string,
  daysAgo: number,
  inH: number,
  inM: number,
  outH: number | null,
  outM: number | null,
  overtimeStatus: AttendanceOvertimeStatus = 'none',
  approvedByLabel: string | null = null,
): AttendanceDayRecord {
  const workDate = isoDaysAgo(daysAgo)
  const hasOut = outH !== null && outM !== null
  return {
    id: createId(),
    appUserId,
    workDate,
    clockInAt: at(daysAgo, inH, inM),
    clockOutAt: hasOut ? at(daysAgo, outH!, outM!) : null,
    clockInLat: OFFICE_LAT + (daysAgo % 3) * 0.002,
    clockInLng: OFFICE_LNG + (daysAgo % 3) * 0.002,
    clockOutLat: hasOut ? OFFICE_LAT + 0.001 : null,
    clockOutLng: hasOut ? OFFICE_LNG + 0.001 : null,
    overtimeStatus,
    approvedAt:
      overtimeStatus === 'approved' ? new Date().toISOString() : null,
    approvedByLabel:
      overtimeStatus === 'approved' ? approvedByLabel : null,
    overtimeReason: null,
    overtimeRequestId: null,
    note: null,
  }
}

/** ?????????????9???????/??????? */
export function sampleAttendanceRecords(
  users: User[],
  adminUserId: string,
): AttendanceDayRecord[] {
  const byName = (name: string) => users.find((u) => u.name === name)?.id
  const adminLabel =
    users.find((u) => u.id === adminUserId)?.name ?? '???'

  const yamada = byName('??')
  const sato = byName('??')
  const kunieda = byName('??')
  const mukai = byName('??')
  const fuchigami = byName('??')
  const mifune = byName('??')
  const nishi = byName('?')
  const kimura = byName('??')
  const tanaka = byName('??')

  const rows: AttendanceDayRecord[] = []

  const add = (row: AttendanceDayRecord | undefined) => {
    if (row) rows.push(row)
  }

  // ??????: daysAgo 6..0 ?????????????1??
  const week = [6, 5, 4, 3, 2, 1, 0] as const

  for (const d of week) {
    if (yamada) {
      if (d === 0) add(mk(yamada, 0, 9, 5, null, null))
      else add(mk(yamada, d, 9, 0, 18, 0))
    }
    if (sato) {
      if (d === 2) {
        add(mk(sato, d, 9, 0, 20, 0, 'pending'))
      } else if (d === 3) {
        add(mk(sato, d, 9, 0, 19, 30, 'approved', adminLabel))
      } else {
        add(mk(sato, d, 9, 0, 18, 0))
      }
    }
    if (kunieda) add(mk(kunieda, d, 8, 45, 17, 45))
    if (mukai) {
      if (d === 4) add(mk(mukai, d, 9, 15, 19, 0, 'pending'))
      else add(mk(mukai, d, 9, 15, 18, 15))
    }
    if (fuchigami) add(mk(fuchigami, d, 9, 30, 18, 30))
    if (mifune && d >= 1) add(mk(mifune, d, 9, 0, 18, 0))
    if (nishi && d <= 5) add(mk(nishi, d, 8, 30, 17, 30))
    if (kimura && d !== 6) add(mk(kimura, d, 9, 0, 18, 0))
    if (tanaka && d >= 2) add(mk(tanaka, d, 9, 0, 19, 0, d === 5 ? 'pending' : 'none'))
  }

  // ???1?????????????????
  if (yamada) add(mk(yamada, 8, 9, 0, 20, 30, 'approved', adminLabel))
  if (sato) add(mk(sato, 9, 9, 0, 18, 0))

  return rows
}
