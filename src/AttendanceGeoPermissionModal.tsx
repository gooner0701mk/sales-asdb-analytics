import { attendanceLabels as t } from './attendance/labels'
import { isStandalonePwa } from './attendance/displayMode'
import './AttendanceTab.css'

type Props = {
  open: boolean
  busy: boolean
  onContinue: () => void
  onLater: () => void
}

export function AttendanceGeoPermissionModal({
  open,
  busy,
  onContinue,
  onLater,
}: Props) {
  if (!open) return null

  const pwa = isStandalonePwa()

  return (
    <div
      className="attendance-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-perm-modal-title"
    >
      <div className="attendance-modal attendance-geo-perm-modal">
        <h3 id="geo-perm-modal-title" className="settings-subheading">
          {t.geoPermModalTitle}
        </h3>
        <p className="hint small">
          {pwa ? t.geoPermModalBodyPwa : t.geoPermModalBodyWeb}
        </p>
        <p className="hint small attendance-geo-perm-modal-choice">
          {t.geoPermModalIosNote}
        </p>
        {!pwa ? (
          <p className="hint small attendance-geo-perm-install-hint">
            {t.geoPermInstallHint}
          </p>
        ) : null}
        <details className="attendance-geo-safari-settings">
          <summary>{t.geoPermSafariSettingsTitle}</summary>
          <ol className="hint small attendance-geo-safari-settings-list">
            <li>{t.geoPermSafariSettings1}</li>
            <li>{t.geoPermSafariSettings2}</li>
            <li>{t.geoPermSafariSettings3}</li>
          </ol>
        </details>
        <div className="attendance-modal-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={onLater}
          >
            {t.geoPermModalLater}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={onContinue}
          >
            {busy ? t.gpsBusy : t.geoPermModalContinue}
          </button>
        </div>
      </div>
    </div>
  )
}
