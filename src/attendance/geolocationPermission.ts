import { captureGps } from './geo'
import { attendanceLabels as t } from './labels'

export type GeoPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'unknown'

/** GPS ?????? secure context?HTTPS ??? localhost? */
export function isGeolocationSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function canUseGeolocationApi(): boolean {
  return (
    isGeolocationSecureContext() &&
    typeof navigator !== 'undefined' &&
    !!navigator.geolocation
  )
}

export async function readGeoPermissionState(): Promise<GeoPermissionState> {
  if (!canUseGeolocationApi()) {
    return 'unsupported'
  }
  try {
    const permissions = navigator.permissions
    if (permissions?.query) {
      const status = await permissions.query({ name: 'geolocation' })
      const state = status.state
      if (state === 'granted' || state === 'denied' || state === 'prompt') {
        return state
      }
    }
  } catch {
    /* Safari ?? Permissions API ????????? */
  }
  return 'unknown'
}

/** ???????????????????????????????????? */
export async function requestGeoPermission(): Promise<GeoPermissionState> {
  if (!canUseGeolocationApi()) {
    throw new Error(t.geoPermInsecureShort)
  }
  try {
    await captureGps()
    return 'granted'
  } catch (e) {
    if (e instanceof Error && e.message === t.geoPermInsecureShort) throw e
    const next = await readGeoPermissionState()
    return next === 'unknown' ? 'denied' : next
  }
}

export function watchGeoPermission(
  onChange: (state: GeoPermissionState) => void,
): () => void {
  if (!canUseGeolocationApi() || !navigator.permissions?.query) {
    return () => {}
  }
  let disposed = false
  let removeListener: (() => void) | null = null
  void navigator.permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      if (disposed) return
      const apply = () => {
        const s = status.state
        if (s === 'granted' || s === 'denied' || s === 'prompt') {
          onChange(s)
        }
      }
      apply()
      status.addEventListener('change', apply)
      removeListener = () => status.removeEventListener('change', apply)
    })
    .catch(() => {})
  return () => {
    disposed = true
    removeListener?.()
  }
}
