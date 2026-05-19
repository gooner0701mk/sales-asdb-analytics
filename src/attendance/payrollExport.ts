import * as XLSX from 'xlsx'
import { MONTHLY_OVERTIME_LIMIT_HOURS } from './constants'
import {
  breakMinutes,
  grossMinutes,
  overtimeMinutes,
  summarizeUserMonthOvertime,
  workMinutes,
} from './metrics'
import { isDateInPayPeriod, payPeriodRangeFromEndYm } from './payPeriod'
import type {
  AttendanceDayRecord,
  AttendanceOvertimeRequest,
  User,
} from '../types'

function userName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? id
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function otStatusJa(
  record: AttendanceDayRecord,
  request: AttendanceOvertimeRequest | null,
): string {
  if (request) {
    switch (request.status) {
      case 'approved':
        return '\u627f\u8a8d\u6e08'
      case 'pending':
        return '\u7533\u8acb\u4e2d'
      case 'rejected':
        return '\u5374\u4e0b'
    }
  }
  switch (record.overtimeStatus) {
    case 'approved':
      return '\u627f\u8a8d\u6e08'
    case 'pending':
      return '\u7533\u8acb\u4e2d'
    case 'rejected':
      return '\u5374\u4e0b'
    default:
      return ''
  }
}

function roundHoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function downloadAttendancePayrollExcel(opts: {
  users: User[]
  records: AttendanceDayRecord[]
  requests?: AttendanceOvertimeRequest[]
  payPeriodEndYm: string
}): void {
  const requests = opts.requests ?? []
  const range = payPeriodRangeFromEndYm(opts.payPeriodEndYm)
  if (!range) return

  const periodRecords = opts.records
    .filter((r) => isDateInPayPeriod(r.workDate, opts.payPeriodEndYm))
    .sort((a, b) => {
      const d = a.workDate.localeCompare(b.workDate)
      if (d !== 0) return d
      return a.appUserId.localeCompare(b.appUserId)
    })

  const requestByUserDate = new Map<string, AttendanceOvertimeRequest>()
  for (const req of requests) {
    if (!isDateInPayPeriod(req.workDate, opts.payPeriodEndYm)) continue
    requestByUserDate.set(`${req.appUserId}\t${req.workDate}`, req)
  }

  const detailHeader = [
    '\u62c5\u5f53',
    '\u52e4\u52d9\u65e5',
    '\u51fa\u52e4',
    '\u9000\u52e4',
    '\u52e4\u52d9(\u5206)',
    '\u4f11\u61a9(\u5206)',
    '\u5b9f\u50cd(\u5206)',
    '\u5b9f\u50cd(h)',
    '\u6b8b\u696d(\u5206)',
    '\u6b8b\u696d(h)',
    '\u4e88\u5b9a\u6b8b\u696d(h)',
    '\u7533\u8acb\u7406\u7531',
    '\u6b8b\u696d\u627f\u8a8d',
  ]

  const detailRows: (string | number)[][] = [detailHeader]

  for (const r of periodRecords) {
    const req = requestByUserDate.get(`${r.appUserId}\t${r.workDate}`) ?? null
    const gross = r.clockOutAt ? grossMinutes(r) : 0
    const br = r.clockOutAt ? breakMinutes(r) : 0
    const work = r.clockOutAt ? workMinutes(r) : 0
    const ot = r.clockOutAt ? overtimeMinutes(r) : 0
    detailRows.push([
      userName(opts.users, r.appUserId),
      r.workDate,
      formatTime(r.clockInAt),
      formatTime(r.clockOutAt),
      gross,
      br,
      work,
      roundHoursFromMinutes(work),
      ot,
      roundHoursFromMinutes(ot),
      req?.plannedHours ?? '',
      req?.reason ?? r.overtimeReason ?? '',
      otStatusJa(r, req),
    ])
  }

  const summaryHeader = [
    '\u62c5\u5f53',
    '\u51fa\u52e4\u65e5\u6570',
    '\u5b9f\u50cd\u5408\u8a08(\u5206)',
    '\u5b9f\u50cd\u5408\u8a08(h)',
    '\u6708\u6b8b\u696d\u5408\u8a08(\u5206)',
    '\u6708\u6b8b\u696d\u5408\u8a08(h)',
    '\u6708\u6b8b\u696d(h)',
    '\u6708\u6b8b\u696d\u6b8b(h)',
    `\u6708\u6b8b\u696d\u4e0a\u9650(h)`,
  ]

  const summaryRows: (string | number)[][] = [
    [`\u7de0\u3081\u671f\u9593: ${range.start} \u301c ${range.end}`],
    summaryHeader,
  ]

  for (const u of opts.users) {
    const mine = periodRecords.filter((r) => r.appUserId === u.id && r.clockOutAt)
    let workSum = 0
    for (const r of mine) {
      workSum += workMinutes(r)
    }
    const monthOt = summarizeUserMonthOvertime(
      opts.records,
      u.id,
      opts.payPeriodEndYm,
    )
    summaryRows.push([
      u.name,
      mine.length,
      workSum,
      roundHoursFromMinutes(workSum),
      monthOt.usedMinutes,
      roundHoursFromMinutes(monthOt.usedMinutes),
      monthOt.usedHoursFloor,
      monthOt.remainingHoursFloor,
      MONTHLY_OVERTIME_LIMIT_HOURS,
    ])
  }

  const wb = XLSX.utils.book_new()
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, wsDetail, '\u65e5\u6b21\u660e\u7d30')
  XLSX.utils.book_append_sheet(wb, wsSummary, '\u62c5\u5f53\u8005\u96c6\u8a08')

  const fname = `\u52e4\u6020\u7d66\u4e0e_${opts.payPeriodEndYm}\u7de0\u3081_${range.start}_${range.end}.xlsx`
  XLSX.writeFile(wb, fname)
}
