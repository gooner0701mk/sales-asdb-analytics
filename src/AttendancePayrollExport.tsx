import { useMemo, useState } from 'react'
import { attendanceLabels as t } from './attendance/labels'
import { downloadAttendancePayrollExcel } from './attendance/payrollExport'
import {
  currentPayPeriodEndYm,
  payPeriodLabel,
  payPeriodRangeFromEndYm,
  shiftPayPeriodEndYm,
} from './attendance/payPeriod'
import type { AttendanceDayRecord, User } from './types'

type Props = {
  users: User[]
  attendanceRecords: AttendanceDayRecord[]
  showToast: (msg: string) => void
}

export function AttendancePayrollExport({
  users,
  attendanceRecords,
  showToast,
}: Props) {
  const [payPeriodEndYm, setPayPeriodEndYm] = useState(() =>
    currentPayPeriodEndYm(),
  )

  const range = useMemo(
    () => payPeriodRangeFromEndYm(payPeriodEndYm),
    [payPeriodEndYm],
  )

  const recordCount = useMemo(() => {
    if (!range) return 0
    return attendanceRecords.filter(
      (r) => r.workDate >= range.start && r.workDate <= range.end,
    ).length
  }, [attendanceRecords, range])

  const onDownload = () => {
    if (!range) {
      showToast(t.payrollInvalidPeriod)
      return
    }
    downloadAttendancePayrollExcel({
      users,
      records: attendanceRecords,
      payPeriodEndYm,
    })
    showToast(t.payrollDownloaded)
  }

  return (
    <section className="panel attendance-payroll-panel">
      <h2 className="targets-heading">{t.payrollHeading}</h2>
      <p className="hint small">{t.payrollHint}</p>
      <div className="attendance-week-nav">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, -1))}
        >
          {t.payrollPrev}
        </button>
        <span className="hint small">{payPeriodLabel(payPeriodEndYm)}</span>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, 1))}
        >
          {t.payrollNext}
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setPayPeriodEndYm(currentPayPeriodEndYm())}
        >
          {t.payrollThis}
        </button>
      </div>
      {range ? (
        <p className="hint small">
          {t.payrollRange}: {range.start}
          {' \u301c '}
          {range.end}
          {'\uff08'}
          {recordCount}
          {t.payrollRecordUnit}
          {'\uff09'}
        </p>
      ) : null}
      <button type="button" className="btn primary" onClick={onDownload}>
        {t.payrollDownloadBtn}
      </button>
    </section>
  )
}
