import { useMemo } from 'react'
import { attendanceLabels as t } from './attendance/labels'
import { formatGps, googleMapsUrl } from './attendance/geo'
import { formatDateJa, isoDaysAgo, todayIsoDate } from './dates'
import type { AttendanceDayRecord, User } from './types'

type Props = {
  users: User[]
  punchUserId: string
  attendanceRecords: AttendanceDayRecord[]
  onClose: () => void
}

function userName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? t.unknownUser
}

function formatClock(iso: string | null): string {
  if (!iso) return t.dash
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return t.dash
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AttendanceGpsPanel({
  users,
  punchUserId,
  attendanceRecords,
  onClose,
}: Props) {
  const today = todayIsoDate()
  const minDate = isoDaysAgo(13)

  const rows = useMemo(() => {
    return [...attendanceRecords]
      .filter(
        (r) =>
          r.appUserId === punchUserId &&
          r.workDate >= minDate &&
          r.workDate <= today,
      )
      .sort((a, b) => b.workDate.localeCompare(a.workDate))
  }, [attendanceRecords, punchUserId, minDate, today])

  return (
    <section className="panel attendance-gps-panel">
      <div className="attendance-correction-head">
        <h3 className="settings-subheading">{t.gpsHeading}</h3>
        <button type="button" className="btn ghost small" onClick={onClose}>
          {t.gpsClose}
        </button>
      </div>
      <p className="hint small">
        {userName(users, punchUserId)}
        {t.gpsHint}
      </p>
      {rows.length === 0 ? (
        <p className="hint small">{t.gpsNoRecords}</p>
      ) : (
        <ul className="attendance-gps-list">
          {rows.map((r) => (
            <li key={r.id} className="attendance-gps-item">
              <p className="attendance-gps-item-title">
                <strong>{formatDateJa(r.workDate)}</strong>
                <span className="hint small">
                  {' '}
                  {t.labelIn} {formatClock(r.clockInAt)}
                  {r.clockOutAt ? (
                    <>
                      {t.arrowOut}
                      {formatClock(r.clockOutAt)}
                    </>
                  ) : null}
                </span>
              </p>
              <p className="hint small attendance-gps-line">
                {t.labelIn}:{' '}
                <a
                  href={googleMapsUrl(r.clockInLat, r.clockInLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatGps(r.clockInLat, r.clockInLng)}
                </a>
                {' '}
                <span className="attendance-gps-map-label">({t.gpsMapLink})</span>
              </p>
              {r.clockOutLat != null && r.clockOutLng != null ? (
                <p className="hint small attendance-gps-line">
                  {t.labelClockOut}:{' '}
                  <a
                    href={googleMapsUrl(r.clockOutLat, r.clockOutLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatGps(r.clockOutLat, r.clockOutLng)}
                  </a>
                  {' '}
                  <span className="attendance-gps-map-label">
                    ({t.gpsMapLink})
                  </span>
                </p>
              ) : (
                <p className="hint small">{t.notYetOut}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
