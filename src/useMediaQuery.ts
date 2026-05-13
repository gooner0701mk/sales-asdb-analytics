import { useEffect, useState } from 'react'

/** MediaQueryList の change 購読（古い Safari は addListener のみ） */
function subscribeMediaQuery(
  mq: MediaQueryList,
  onChange: () => void,
): () => void {
  try {
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  } catch {
    /* ignore */
  }
  return () => {}
}

/** クライアントで `window.matchMedia` を購読する（SSR 時は false） */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(query)
    } catch {
      return
    }
    const onChange = () => {
      try {
        setMatches(mq.matches)
      } catch {
        setMatches(false)
      }
    }
    onChange()
    return subscribeMediaQuery(mq, onChange)
  }, [query])

  return matches
}