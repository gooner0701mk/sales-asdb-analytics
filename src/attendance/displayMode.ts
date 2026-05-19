/** ?????????? PWA ?????????? */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}
