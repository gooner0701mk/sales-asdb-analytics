import { useCallback, useEffect, useMemo, useState } from 'react'
import { attendanceLabels as t } from './attendance/labels'
import { verifyAttendancePassword } from './attendance/password'
import {
  buildEditedRecord,
  createManualAttendanceRecord,
  datetimeLocalToIso,
  isoToDatetimeLocalValue,
  workDateFromIsoLocal,
} from './attendance/recordEdit'
import { formatDateJa, isoDaysAgo, todayIsoDate } from './dates'
import type { AppState, AttendanceDayRecord, User } from './types'

type Props = {
  users: User[]
  attendanceRecords: AttendanceDayRecord[]
  passwordHash: string
  setState: React.Dispatch<React.SetStateAction<AppState>>
  showToast: (msg: string) => void
  onClose: () => void
}

function userName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? t.unknownUser
}

type EditDraft = {
  clockIn: string
  clockOut: string
}

function defaultDatetimeLocal(workDate: string, hour: number, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${workDate}T${pad(hour)}:${pad(minute)}`
}

export function AttendanceCorrectionPanel({
  users,
  attendanceRecords,
  passwordHash,
  setState,
  showToast,
  onClose,
}: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [rangeMode, setRangeMode] = useState<'today' | 'week' | 'month'>('week')
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({})
  const today = todayIsoDate()
  const [addUserId, setAddUserId] = useState(() => users[0]?.id ?? '')
  const [addClockIn, setAddClockIn] = useState(() => defaultDatetimeLocal(today, 9))
  const [addClockOut, setAddClockOut] = useState(() => defaultDatetimeLocal(today, 18))

  useEffect(() => {
    if (users.length === 0) return
    if (!users.some((u) => u.id === addUserId)) {
      setAddUserId(users[0]!.id)
    }
  }, [users, addUserId])

  const visibleRecords = useMemo(() => {
    const sorted = [...attendanceRecords].sort((a, b) => {
      const d = b.workDate.localeCompare(a.workDate)
      if (d !== 0) return d
      return b.clockInAt.localeCompare(a.clockInAt)
    })
    if (rangeMode === 'today') {
      return sorted.filter((r) => r.workDate === today)
    }
    const minDate = isoDaysAgo(rangeMode === 'week' ? 6 : 30)
    return sorted.filter((r) => r.workDate >= minDate && r.workDate <= today)
  }, [attendanceRecords, rangeMode, today])

  const tryUnlock = useCallback(async () => {
    if (!passwordHash) {
      showToast(t.correctionNoPassword)
      return
    }
    try {
      const ok = await verifyAttendancePassword(passwordInput, passwordHash)
      if (!ok) {
        showToast(t.correctionWrongPassword)
        return
      }
      setUnlocked(true)
      setPasswordInput('')
    } catch {
      showToast(t.correctionUnlockFailed)
    }
  }, [passwordHash, passwordInput, showToast])

  const getDraft = (r: AttendanceDayRecord): EditDraft => {
    const hit = drafts[r.id]
    if (hit) return hit
    return {
      clockIn: isoToDatetimeLocalValue(r.clockInAt),
      clockOut: r.clockOutAt ? isoToDatetimeLocalValue(r.clockOutAt) : '',
    }
  }

  const setDraftField = (
    id: string,
    base: AttendanceDayRecord,
    field: keyof EditDraft,
    value: string,
  ) => {
    const cur = getDraft(base)
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...cur, [field]: value },
    }))
  }

  const saveRecord = (r: AttendanceDayRecord) => {
    const d = getDraft(r)
    const inIso = datetimeLocalToIso(d.clockIn)
    if (!inIso) {
      showToast(t.correctionInvalidIn)
      return
    }
    const outIso = d.clockOut.trim() ? datetimeLocalToIso(d.clockOut) : null
    if (d.clockOut.trim() && !outIso) {
      showToast(t.correctionInvalidOut)
      return
    }
    const next = buildEditedRecord(r, inIso, outIso)
    setState((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.map((row) =>
        row.id === r.id ? next : row,
      ),
    }))
    setDrafts((prev) => {
      const copy = { ...prev }
      delete copy[r.id]
      return copy
    })
    showToast(t.correctionSaved)
  }

  const deleteRecord = (r: AttendanceDayRecord) => {
    if (!window.confirm(t.correctionDeleteConfirm)) return
    setState((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.filter((row) => row.id !== r.id),
    }))
    setDrafts((prev) => {
      const copy = { ...prev }
      delete copy[r.id]
      return copy
    })
    showToast(t.correctionDeleted)
  }

  const addRecord = () => {
    if (!addUserId) {
      showToast(t.correctionAddNeedUser)
      return
    }
    const inIso = datetimeLocalToIso(addClockIn)
    if (!inIso) {
      showToast(t.correctionInvalidIn)
      return
    }
    const outIso = addClockOut.trim() ? datetimeLocalToIso(addClockOut) : null
    if (addClockOut.trim() && !outIso) {
      showToast(t.correctionInvalidOut)
      return
    }
    if (outIso && Date.parse(outIso) <= Date.parse(inIso)) {
      showToast(t.correctionOutBeforeIn)
      return
    }
    const workDate = workDateFromIsoLocal(inIso)
    if (!workDate) {
      showToast(t.correctionInvalidIn)
      return
    }
    const duplicate = attendanceRecords.some(
      (r) => r.appUserId === addUserId && r.workDate === workDate,
    )
    if (duplicate) {
      showToast(t.correctionAddDuplicate)
      return
    }
    const row = createManualAttendanceRecord({
      appUserId: addUserId,
      clockInIso: inIso,
      clockOutIso: outIso,
    })
    if (!row) {
      showToast(t.correctionInvalidIn)
      return
    }
    setState((prev) => ({
      ...prev,
      attendanceRecords: [...prev.attendanceRecords, row],
    }))
    showToast(t.correctionAddSaved)
  }

  if (!unlocked) {
    return (
      <section className="panel attendance-correction-gate">
        <h3 className="settings-subheading">{t.correctionHeading}</h3>
        <p className="hint small">{t.correctionHint}</p>
        {!passwordHash ? (
          <p className="hint small">{t.correctionNoPassword}</p>
        ) : (
          <label className="field">
            <span className="field-label">{t.correctionPassword}</span>
            <input
              type="password"
              className="cell-input"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        )}
        <div className="attendance-correction-gate-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t.correctionClose}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!passwordHash}
            onClick={() => void tryUnlock()}
          >
            {t.correctionUnlock}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel attendance-correction-panel">
      <div className="attendance-correction-head">
        <h3 className="settings-subheading">{t.correctionHeading}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          {t.correctionClose}
        </button>
      </div>
      <section className="attendance-correction-add">
        <h4 className="settings-subheading">{t.correctionAddHeading}</h4>
        <p className="hint small">{t.correctionAddHint}</p>
        <div className="attendance-correction-fields">
          <label className="field">
            <span className="field-label">{t.labelPunchUser}</span>
            <select
              className="cell-input"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.labelClockIn}</span>
            <input
              type="datetime-local"
              className="cell-input"
              value={addClockIn}
              onChange={(e) => setAddClockIn(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t.labelClockOut}</span>
            <input
              type="datetime-local"
              className="cell-input"
              value={addClockOut}
              onChange={(e) => setAddClockOut(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn primary small"
          disabled={users.length === 0}
          onClick={addRecord}
        >
          {t.correctionAddSubmit}
        </button>
      </section>
      <div className="attendance-week-nav">
        <span className="hint small">{t.correctionDays}</span>
        <button
          type="button"
          className={`btn ghost small ${rangeMode === 'today' ? 'active' : ''}`}
          onClick={() => setRangeMode('today')}
        >
          {t.correctionDaysToday}
        </button>
        <button
          type="button"
          className={`btn ghost small ${rangeMode === 'week' ? 'active' : ''}`}
          onClick={() => setRangeMode('week')}
        >
          {t.correctionDays7}
        </button>
        <button
          type="button"
          className={`btn ghost small ${rangeMode === 'month' ? 'active' : ''}`}
          onClick={() => setRangeMode('month')}
        >
          {t.correctionDays31}
        </button>
      </div>
      {visibleRecords.length === 0 ? (
        <p className="hint small">{t.dash}</p>
      ) : (
        <ul className="attendance-correction-list">
          {visibleRecords.map((r) => {
            const d = getDraft(r)
            return (
              <li key={r.id} className="attendance-correction-item">
                <p className="attendance-correction-item-title">
                  <strong>{userName(users, r.appUserId)}</strong>
                  <span className="hint small">
                    {' '}
                    {formatDateJa(r.workDate)}
                  </span>
                </p>
                <div className="attendance-correction-fields">
                  <label className="field">
                    <span className="field-label">{t.labelClockIn}</span>
                    <input
                      type="datetime-local"
                      className="cell-input"
                      value={d.clockIn}
                      onChange={(e) =>
                        setDraftField(r.id, r, 'clockIn', e.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t.labelClockOut}</span>
                    <input
                      type="datetime-local"
                      className="cell-input"
                      value={d.clockOut}
                      onChange={(e) =>
                        setDraftField(r.id, r, 'clockOut', e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="attendance-correction-item-actions">
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => saveRecord(r)}
                  >
                    {t.correctionSave}
                  </button>
                  <button
                    type="button"
                    className="btn danger ghost small"
                    onClick={() => deleteRecord(r)}
                  >
                    {t.correctionDelete}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
