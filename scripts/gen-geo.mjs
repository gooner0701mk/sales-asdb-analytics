import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'attendance',
  'geo.ts',
)

const src = `export type GpsCapture = {
  lat: number
  lng: number
  accuracyM: number
}

export function captureGps(): Promise<GpsCapture> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('\u3053\u306e\u7aef\u672b\u3067\u306f\u4f4d\u7f6e\u60c5\u5831\uff08GPS\uff09\u304c\u4f7f\u3048\u307e\u305b\u3093'))
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
          reject(new Error('\u4f4d\u7f6e\u60c5\u5831\u306e\u5229\u7528\u304c\u62d2\u5426\u3055\u308c\u307e\u3057\u305f\u3002\u30d6\u30e9\u30a6\u30b6\u306e\u8a2d\u5b9a\u3067\u8a31\u53ef\u3057\u3066\u304f\u3060\u3055\u3044'))
        } else if (code === 2) {
          reject(new Error('\u4f4d\u7f6e\u60c5\u5831\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\uff08\u570f\u5916\u306e\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\uff09'))
        } else if (code === 3) {
          reject(new Error('\u4f4d\u7f6e\u60c5\u5831\u306e\u53d6\u5f97\u304c\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u3057\u307e\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044'))
        } else {
          reject(new Error(err.message || '\u4f4d\u7f6e\u60c5\u5831\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f'))
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

export function formatGps(lat: number, lng: number, accuracyM?: number): string {
  const base = \`\${lat.toFixed(5)}, \${lng.toFixed(5)}\`
  if (accuracyM != null && Number.isFinite(accuracyM)) {
    return \`\${base}\uff08\u7cbe\u5ea6 \u00b1\${Math.round(accuracyM)}m\uff09\`
  }
  return base
}
`

fs.writeFileSync(out, src, 'utf8')
console.log('geo.ts ok')
