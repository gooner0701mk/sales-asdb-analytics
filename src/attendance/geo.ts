import { attendanceLabels as t } from './labels'

export type GpsCapture = {
  lat: number
  lng: number
  accuracyM: number
}

export function captureGps(): Promise<GpsCapture> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      reject(new Error(t.geoPermInsecureShort))
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error(t.gpsErrUnsupported))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        })
      },
      (err) => {
        const code = err.code
        if (code === 1) {
          reject(new Error(t.gpsErrDenied))
        } else if (code === 2) {
          reject(new Error(t.gpsErrUnavailable))
        } else if (code === 3) {
          reject(new Error(t.gpsErrTimeout))
        } else {
          reject(new Error(t.gpsErrUnknown))
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}`
}

export function formatGps(lat: number, lng: number, accuracyM?: number): string {
  const base = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  if (accuracyM != null && Number.isFinite(accuracyM)) {
    return `${base}${t.gpsAccuracyFmt.replace('{m}', String(Math.round(accuracyM)))}`
  }
  return base
}
