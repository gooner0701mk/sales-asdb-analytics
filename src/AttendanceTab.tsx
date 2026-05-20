import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { AttendanceCorrectionPanel } from './AttendanceCorrectionPanel'
import { AttendanceGeoPermissionModal } from './AttendanceGeoPermissionModal'
import { AttendanceGpsPanel } from './AttendanceGpsPanel'
import { AttendancePayrollExport } from './AttendancePayrollExport'
import { captureGps, formatGps, googleMapsUrl } from './attendance/geo'
import {
  canUseGeolocationApi,
  isGeolocationSecureContext,
  readGeoPermissionState,
  requestGeoPermission,
  watchGeoPermission,
  type GeoPermissionState,
} from './attendance/geolocationPermission'
import { attendanceLabels as t } from './attendance/labels'
import {
  formatHoursFloorFromMinutes,
  formatMinutesJa,
  overtimeHoursFloor,
  overtimeMinutes,
  summarizeUserMonthOvertime,
  summarizeUserWeek,
  weekEndSunday,
  weekStartMonday,
  workMinutes,
} from './attendance/metrics'
import {
  currentPayPeriodEndYm,
  payPeriodLabel,
  shiftPayPeriodEndYm,
} from './attendance/payPeriod'
import { resolveTodayWorkStatus } from './attendance/todayStatus'
import { createId } from './createId'
import { formatDateJa, todayIsoDate } from './dates'
import { useMediaQuery } from './useMediaQuery'
import type {
  AppState,
  AttendanceDayRecord,
  User,
} from './types'
import './AttendanceTab.css'

type Props = {
  users: User[]
  sessionUserId: string | null
  attendanceRecords: AttendanceDayRecord[]
  attendanceCorrectionPasswordHash: string
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
}

function userName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? t.unknownUser
}

function formatClockTime(iso: string | null): string {
  if (!iso) return t.dash
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return t.dash
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AttendanceTab({
  users,
  sessionUserId,
  attendanceRecords,
  attendanceCorrectionPasswordHash,
  setState,
  showToast,
}: Props) {
  const narrow = useMediaQuery('(max-width: 960px)')
  const today = todayIsoDate()
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(today))
  const [payPeriodEndYm, setPayPeriodEndYm] = useState(() =>
    currentPayPeriodEndYm(today),
  )
  const [gpsBusy, setGpsBusy] = useState(false)
  const [geoPermission, setGeoPermission] = useState<GeoPermissionState>('unknown')
  const [geoGuideOpen, setGeoGuideOpen] = useState(false)
  const [punchUserId, setPunchUserId] = useState(sessionUserId ?? '')
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [gpsOpen, setGpsOpen] = useState(false)
  const correctionAnchorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (sessionUserId && !punchUserId) setPunchUserId(sessionUserId)
  }, [sessionUserId, punchUserId])

  useEffect(() => {
    void readGeoPermissionState().then(setGeoPermission)
    return watchGeoPermission(setGeoPermission)
  }, [])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void readGeoPermissionState().then(setGeoPermission)
      }
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const refreshGeoPermission = useCallback(async () => {
    setGpsBusy(true)
    try {
      const next = await requestGeoPermission()
      setGeoPermission(next)
      if (next === 'granted') {
        setGeoGuideOpen(false)
        showToast(t.geoPermOkToast)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t.gpsErrUnknown)
      void readGeoPermissionState().then(setGeoPermission)
    } finally {
      setGpsBusy(false)
    }
  }, [showToast])

  const geoInsecure = !isGeolocationSecureContext()

  const openGeoGuide = useCallback(() => {
    if (geoInsecure) return
    if (geoPermission === 'denied' || geoPermission === 'unsupported') return
    setGeoGuideOpen(true)
  }, [geoInsecure, geoPermission])

  useEffect(() => {
    if (geoInsecure) return
    if (geoPermission === 'granted' || geoPermission === 'denied') return
    if (geoPermission === 'unsupported') return
    const key = 'sales-attendance-geo-guide-shown'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setGeoGuideOpen(true)
  }, [geoPermission, geoInsecure])

  const ensureGeoForPunch = useCallback((): boolean => {
    if (geoInsecure) return true
    if (geoPermission === 'granted') return true
    if (geoPermission === 'denied' || geoPermission === 'unsupported') {
      showToast(t.geoPermDenied)
      return false
    }
    openGeoGuide()
    return false
  }, [geoInsecure, geoPermission, openGeoGuide, showToast])
  useEffect(() => {
    if (!correctionOpen) return
    const id = window.setTimeout(() => {
      correctionAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)
    return () => window.clearTimeout(id)
  }, [correctionOpen])

  const openToday = useMemo(() => {
    if (!punchUserId) return null
    return (
      attendanceRecords.find(
        (r) =>
          r.appUserId === punchUserId &&
          r.workDate === today &&
          r.clockOutAt === null,
      ) ?? null
    )
  }, [attendanceRecords, punchUserId, today])

  const todayRecord = useMemo(() => {
    if (!punchUserId) return null
    return (
      attendanceRecords.find(
        (r) => r.appUserId === punchUserId && r.workDate === today,
      ) ?? null
    )
  }, [attendanceRecords, punchUserId, today])

  const todayClosed = todayRecord?.clockOutAt ? todayRecord : null

  const myMonth = useMemo(() => {
    if (!punchUserId) return null
    return summarizeUserMonthOvertime(
      attendanceRecords,
      punchUserId,
      payPeriodEndYm,
    )
  }, [attendanceRecords, punchUserId, payPeriodEndYm])

  const myWeek = useMemo(() => {
    if (!punchUserId) return null
    return summarizeUserWeek(attendanceRecords, punchUserId, weekStart)
  }, [attendanceRecords, punchUserId, weekStart])

  const teamMonth = useMemo(
    () =>
      users.map((u) =>
        summarizeUserMonthOvertime(attendanceRecords, u.id, payPeriodEndYm),
      ),
    [users, attendanceRecords, payPeriodEndYm],
  )

  const teamWeek = useMemo(
    () =>
      users.map((u) => summarizeUserWeek(attendanceRecords, u.id, weekStart)),
    [users, attendanceRecords, weekStart],
  )

  const teamTodayRows = useMemo(() => {
    const rows = users.map((u) => {
      const status = resolveTodayWorkStatus(attendanceRecords, u.id, today)
      return { user: u, status }
    })
    const rank = (s: (typeof rows)[0]['status']) =>
      s.kind === 'in' ? 0 : s.kind === 'out' ? 1 : 2
    return [...rows].sort((a, b) => {
      const d = rank(a.status) - rank(b.status)
      if (d !== 0) return d
      return a.user.name.localeCompare(b.user.name, 'ja')
    })
  }, [users, attendanceRecords, today])

  const punchIn = useCallback(async () => {
    if (!punchUserId) {
      showToast(t.toastSelectUser)
      return
    }
    if (!ensureGeoForPunch()) return
    if (openToday) {
      showToast(t.toastAlreadyIn)
      return
    }
    if (todayClosed) {
      showToast(t.toastAlreadyOut)
      return
    }
    setGpsBusy(true)
    try {
      const gps = canUseGeolocationApi()
        ? await captureGps()
        : { lat: 0, lng: 0, accuracyM: 0 }
      const now = new Date().toISOString()
      const row: AttendanceDayRecord = {
        id: createId(),
        appUserId: punchUserId,
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
        overtimeReason: null,
        overtimeRequestId: null,
        note: null,
      }
      setState((prev) => ({
        ...prev,
        attendanceRecords: [...prev.attendanceRecords, row],
      }))
      if (canUseGeolocationApi()) {
        setGeoPermission('granted')
        showToast(t.toastInOk)
      } else {
        showToast(t.toastPunchWithoutGps)
      }
    } catch (e) {
      void readGeoPermissionState().then(setGeoPermission)
      showToast(e instanceof Error ? e.message : t.toastInFail)
    } finally {
      setGpsBusy(false)
    }
  }, [punchUserId, openToday, todayClosed, today, setState, showToast, ensureGeoForPunch])

  const punchOut = useCallback(async () => {
    if (!punchUserId || !openToday) {
      showToast(t.toastNoIn)
      return
    }
    if (!ensureGeoForPunch()) return
    setGpsBusy(true)
    try {
      const gps = canUseGeolocationApi()
        ? await captureGps()
        : { lat: 0, lng: 0, accuracyM: 0 }
      const now = new Date().toISOString()
      const draft: AttendanceDayRecord = {
        ...openToday,
        clockOutAt: now,
        clockOutLat: gps.lat,
        clockOutLng: gps.lng,
        overtimeStatus: 'none',
      }
      const ot = overtimeMinutes(draft)
      setState((prev) => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map((r) =>
          r.id === openToday.id
            ? {
                ...r,
                clockOutAt: now,
                clockOutLat: gps.lat,
                clockOutLng: gps.lng,
                overtimeStatus: 'none',
                overtimeRequestId: null,
                overtimeReason: null,
                approvedAt: null,
                approvedByLabel: null,
              }
            : r,
        ),
      }))
      if (canUseGeolocationApi()) {
        setGeoPermission('granted')
        if (ot > 0) {
          showToast(
            t.toastOutOkOt.replace('{ot}', formatHoursFloorFromMinutes(ot)),
          )
        } else {
          showToast(t.toastOutOk)
        }
      } else {
        showToast(t.toastPunchWithoutGps)
      }
    } catch (e) {
      void readGeoPermissionState().then(setGeoPermission)
      showToast(e instanceof Error ? e.message : t.toastOutFail)
    } finally {
      setGpsBusy(false)
    }
  }, [punchUserId, openToday, setState, showToast, ensureGeoForPunch])

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setWeekStart(weekStartMonday(next))
  }

  const onDuty = openToday !== null
  const geoGranted = !geoInsecure && geoPermission === 'granted'
  const geoBlocked =
    !geoInsecure &&
    (geoPermission === 'denied' || geoPermission === 'unsupported')
  const dutyLabel = !punchUserId
    ? t.dutyNoUser
    : onDuty
      ? t.dutyOn
      : todayClosed
        ? t.dutyDone
        : t.dutyOff

  return (
    <div className="attendance-tab">
      <AttendanceGeoPermissionModal
        open={geoGuideOpen && !geoInsecure}
        busy={gpsBusy}
        onContinue={() => void refreshGeoPermission()}
        onLater={() => setGeoGuideOpen(false)}
      />
      <section className="panel attendance-punch-panel">
        <h2 className="targets-heading">{t.headingPunch}</h2>
        <p className="hint small">{t.hintGps}</p>
        {geoInsecure ? (
          <div className="attendance-geo-perm-banner denied">
            <p className="attendance-geo-perm-title">{t.geoPermInsecureTitle}</p>
            <p className="hint small">{t.geoPermInsecureBody}</p>
            <ol className="hint small attendance-geo-safari-settings-list">
              <li>{t.geoPermInsecureFixDev}</li>
              <li>{t.geoPermInsecureFixProd}</li>
            </ol>
            <p className="hint small attendance-geo-perm-warn">
              {t.geoPermPunchWithoutGpsBtn}
            </p>
          </div>
        ) : geoGranted ? (
          <p className="attendance-geo-perm-status granted">{t.geoPermGranted}</p>
        ) : (
          <div
            className={`attendance-geo-perm-banner ${geoBlocked ? 'denied' : ''}`}
          >
            <p className="attendance-geo-perm-title">{t.geoPermHeading}</p>
            <p className="hint small">{t.geoPermHint}</p>
            {geoBlocked ? (
              <>
                <p className="hint small attendance-geo-perm-warn">
                  {t.geoPermDenied}
                </p>
                <p className="hint small">{t.geoPermDeniedIos}</p>
                <details className="attendance-geo-safari-settings">
                  <summary>{t.geoPermSafariSettingsTitle}</summary>
                  <ol className="hint small attendance-geo-safari-settings-list">
                    <li>{t.geoPermSafariSettings1}</li>
                    <li>{t.geoPermSafariSettings2}</li>
                    <li>{t.geoPermSafariSettings3}</li>
                  </ol>
                </details>
              </>
            ) : (
              <button
                type="button"
                className="btn primary small"
                disabled={gpsBusy}
                onClick={openGeoGuide}
              >
                {gpsBusy ? t.gpsBusy : t.geoPermRequestBtn}
              </button>
            )}
          </div>
        )}
        <label className="field attendance-punch-user-field">
          <span className="field-label">{t.labelPunchUser}</span>
          <select
            className="cell-input"
            value={punchUserId}
            onChange={(e) => setPunchUserId(e.target.value)}
          >
            <option value="">{t.notSelected}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`attendance-status-pill ${onDuty ? 'on' : 'off'}`}
        >
          {dutyLabel}
        </span>
        <div className="attendance-today-times">
          <h3 className="attendance-today-times-title">
            {t.todayHeading}
            <span className="hint small">
              {'\uFF08'}
              {formatDateJa(today)}
              {'\uFF09'}
            </span>
          </h3>
          <dl className="attendance-today-times-dl">
            <div>
              <dt>{t.labelClockIn}</dt>
              <dd>
                {todayRecord
                  ? formatClockTime(todayRecord.clockInAt)
                  : t.dash}
              </dd>
            </div>
            <div>
              <dt>{t.labelClockOut}</dt>
              <dd>
                {todayRecord?.clockOutAt
                  ? formatClockTime(todayRecord.clockOutAt)
                  : onDuty
                    ? t.notYetOut
                    : t.dash}
              </dd>
            </div>
          </dl>
              {todayRecord && todayClosed ? (
            <p className="hint small">
              {t.labelWork} {formatMinutesJa(workMinutes(todayClosed))}
              {overtimeMinutes(todayClosed) > 0 ? (
                <>
                  {' '}
                  / {t.labelOt} {overtimeHoursFloor(todayClosed)}
                  {t.hourUnit}
                </>
              ) : null}
            </p>
          ) : null}
          {todayRecord ? (
            <p className="hint small attendance-gps-line">
              {t.labelIn}{' '}
              <a
                href={googleMapsUrl(todayRecord.clockInLat, todayRecord.clockInLng)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatGps(todayRecord.clockInLat, todayRecord.clockInLng)}
              </a>
              {todayRecord.clockOutLat != null &&
              todayRecord.clockOutLng != null ? (
                <>
                  <br />
                  {t.labelClockOut}:{' '}
                  <a
                    href={googleMapsUrl(
                      todayRecord.clockOutLat,
                      todayRecord.clockOutLng,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatGps(todayRecord.clockOutLat, todayRecord.clockOutLng)}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="attendance-punch-actions">
          <button
            type="button"
            className="btn primary attendance-punch-btn"
            disabled={
              gpsBusy || onDuty || !!todayClosed || !punchUserId || geoBlocked
            }
            onClick={() => void punchIn()}
          >
            {gpsBusy ? t.gpsBusy : t.btnIn}
          </button>
          <button
            type="button"
            className="btn attendance-punch-btn"
            disabled={gpsBusy || !onDuty || geoBlocked}
            onClick={() => void punchOut()}
          >
            {gpsBusy ? t.gpsBusy : t.btnOut}
          </button>
        </div>
        <div className="attendance-team-today-wrap">
          <h3 className="attendance-team-today-heading">{t.teamTodayHeading}</h3>
          <div className="attendance-team-today-scroll">
            <table className="attendance-team-today-table">
              <thead>
                <tr>
                  <th>{t.teamTodayThName}</th>
                  <th>{t.teamTodayThStatus}</th>
                </tr>
              </thead>
              <tbody>
                {teamTodayRows.map(({ user, status }) => {
                  if (status.kind === 'in') {
                    return (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>
                          <span className="attendance-team-status attendance-team-status-in">
                            {t.teamTodayStatusIn}
                          </span>
                        </td>
                      </tr>
                    )
                  }
                  if (status.kind === 'out') {
                    return (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>
                          <span className="attendance-team-status attendance-team-status-out">
                            {t.teamTodayStatusOut}
                          </span>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>
                        <span className="attendance-team-status attendance-team-status-none">
                          {t.teamTodayStatusNone}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="attendance-extra-launch">
          {punchUserId ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setGpsOpen((v) => !v)}
            >
              {gpsOpen ? t.gpsClose : t.gpsOpen}
            </button>
          ) : null}
          <button
            type="button"
            className="btn ghost"
            onClick={() => setCorrectionOpen((v) => !v)}
          >
            {correctionOpen ? t.correctionClose : t.correctionOpen}
          </button>
        </div>
      </section>

      {correctionOpen ? (
        <div ref={correctionAnchorRef}>
          <AttendanceCorrectionPanel
            users={users}
            attendanceRecords={attendanceRecords}
            passwordHash={attendanceCorrectionPasswordHash}
            setState={setState}
            showToast={showToast}
            onClose={() => setCorrectionOpen(false)}
          />
        </div>
      ) : null}

      {gpsOpen && punchUserId ? (
        <AttendanceGpsPanel
          users={users}
          punchUserId={punchUserId}
          attendanceRecords={attendanceRecords}
          onClose={() => setGpsOpen(false)}
        />
      ) : null}

      {myWeek && myMonth && punchUserId ? (
        <section className="panel">
          <h3 className="settings-subheading">{t.myWeek}</h3>
          <div className="attendance-week-nav">
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, -1))
              }
            >
              {t.payrollPrev}
            </button>
            <span className="hint small">{payPeriodLabel(payPeriodEndYm)}</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, 1))
              }
            >
              {t.payrollNext}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setPayPeriodEndYm(currentPayPeriodEndYm(today))}
            >
              {t.payrollThis}
            </button>
          </div>
          <p className="hint small">{t.monthOtPeriodHint}</p>
          <div className="attendance-summary-grid">
            <div className="attendance-summary-card">
              <span className="hint small">{t.sumWork}</span>
              <strong>{formatMinutesJa(myWeek.workMinutes)}</strong>
            </div>
            <div className="attendance-summary-card">
              <span className="hint small">{t.sumOt}</span>
              <strong>
                {myWeek.overtimeHoursFloor}
                {t.hourUnit}
              </strong>
            </div>
            <div className="attendance-summary-card">
              <span className="hint small">{t.sumWeekExcess}</span>
              <strong className={myWeek.weeklyExcessMinutes > 0 ? 'over-excess' : ''}>
                {myWeek.weeklyExcessHoursFloor}
                {t.hourUnit}
              </strong>
            </div>
            <div className="attendance-summary-card">
              <span className="hint small">{t.sumWeekRegularRemaining}</span>
              <strong>
                {myWeek.weeklyRegularRemainingHoursFloor}
                {t.hourUnit}
              </strong>
            </div>
            <div
              className={`attendance-summary-card ${myMonth.isWarning || myMonth.isExceeded ? 'ot-cap-warning' : ''}`}
            >
              <span className="hint small">{t.sumMonthOtRemaining}</span>
              <strong
                className={
                  myMonth.isWarning || myMonth.isExceeded ? 'ot-cap-warning' : ''
                }
              >
                {myMonth.remainingHoursFloor}
                {t.hourUnit}
              </strong>
              <span className="hint small">
                {'\uFF08'}
                {t.labelOt} {myMonth.usedHoursFloor}/{20}
                {t.hourUnit}
                {'\uFF09'}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h3 className="settings-subheading">{t.teamWeek}</h3>
        <div className="attendance-week-nav">
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, -1))
            }
          >
            {t.payrollPrev}
          </button>
          <span className="hint small">{payPeriodLabel(payPeriodEndYm)}</span>
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              setPayPeriodEndYm((v) => shiftPayPeriodEndYm(v, 1))
            }
          >
            {t.payrollNext}
          </button>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setPayPeriodEndYm(currentPayPeriodEndYm(today))}
          >
            {t.payrollThis}
          </button>
        </div>
        <div className="attendance-week-nav">
          <button type="button" className="btn ghost small" onClick={() => shiftWeek(-1)}>
            {t.prevWeek}
          </button>
          <span className="hint small">
            {formatDateJa(weekStart)}
            {t.rangeSep}
            {formatDateJa(weekEndSunday(weekStart))}
          </span>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setWeekStart(weekStartMonday(today))}
          >
            {t.thisWeek}
          </button>
          <button type="button" className="btn ghost small" onClick={() => shiftWeek(1)}>
            {t.nextWeek}
          </button>
        </div>
        <div className="attendance-team-table-wrap">
          <table className="targets-table attendance-team-table">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colWeekWork}</th>
                <th>{t.colOt}</th>
                <th>{t.colWeekExcess}</th>
                <th>{t.colMonthOtRemain}</th>
              </tr>
            </thead>
            <tbody>
              {teamWeek.map((row) => {
                const monthRow = teamMonth.find(
                  (m) => m.appUserId === row.appUserId,
                )
                const monthWarn =
                  monthRow?.isWarning || monthRow?.isExceeded
                return (
                <tr key={row.appUserId}>
                  <td>{userName(users, row.appUserId)}</td>
                  <td>{formatMinutesJa(row.workMinutes)}</td>
                  <td>{row.overtimeHoursFloor}</td>
                  <td className={row.weeklyExcessMinutes > 0 ? 'over-excess' : ''}>
                    {row.weeklyExcessHoursFloor}
                  </td>
                  <td className={monthWarn ? 'ot-cap-warning' : ''}>
                    {monthRow?.remainingHoursFloor ?? 0}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {narrow ? <p className="hint small">{t.scrollHint}</p> : null}
      </section>

      <AttendancePayrollExport
        users={users}
        attendanceRecords={attendanceRecords}
        showToast={showToast}
      />

      <p className="hint small panel">{t.adminHint}</p>
    </div>
  )
}