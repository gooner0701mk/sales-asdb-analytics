import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { todayIsoDate } from './dates'
import { fyStartYearFromCalendarYm } from './fiscalYear'

const INTERVAL_MS = 60_000

function currentCalendarYmFy(fiscalYearStartMonth: number): { ym: string; fy: number } {
  const ym = todayIsoDate().slice(0, 7)
  return { ym, fy: fyStartYearFromCalendarYm(ym, fiscalYearStartMonth) }
}

/**
 * ローカル日付が月をまたいだ（または会計年度が切り替わった）とき、
 * ユーザーが「直前の暦の今月／今の会計年度」を見ていた場合だけ、選択を新しい暦に合わせる。
 * 過去月・過去年度を手動で選んでいるときは変更しない。
 */
export function useInvoiceCalendarPeriodAutoSync(opts: {
  fiscalYearStartMonth: number
  setFocusYm: Dispatch<SetStateAction<string>>
  setFocusFyStartYear: Dispatch<SetStateAction<number>>
}): void {
  const { fiscalYearStartMonth, setFocusYm, setFocusFyStartYear } = opts
  const lastYmRef = useRef<string | null>(null)
  const lastFyRef = useRef<number | null>(null)

  useEffect(() => {
    const sync = () => {
      const { ym, fy } = currentCalendarYmFy(fiscalYearStartMonth)
      if (lastYmRef.current === null) {
        lastYmRef.current = ym
        lastFyRef.current = fy
        return
      }
      const prevYm = lastYmRef.current
      const prevFy = lastFyRef.current!
      if (ym === prevYm && fy === prevFy) return
      lastYmRef.current = ym
      lastFyRef.current = fy
      setFocusYm((cur) => (cur === prevYm ? ym : cur))
      setFocusFyStartYear((cur) => (cur === prevFy ? fy : cur))
    }

    sync()
    const id = window.setInterval(sync, INTERVAL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fiscalYearStartMonth, setFocusYm, setFocusFyStartYear])
}

/** 目標の「対象年度」だけを暦の現在年度に追従させる */
export function useInvoiceTargetFyAutoSync(opts: {
  fiscalYearStartMonth: number
  setTargetFy: Dispatch<SetStateAction<number>>
}): void {
  const { fiscalYearStartMonth, setTargetFy } = opts
  const lastFyRef = useRef<number | null>(null)

  useEffect(() => {
    const sync = () => {
      const fy = fyStartYearFromCalendarYm(
        todayIsoDate().slice(0, 7),
        fiscalYearStartMonth,
      )
      if (lastFyRef.current === null) {
        lastFyRef.current = fy
        return
      }
      const prevFy = lastFyRef.current
      if (fy === prevFy) return
      lastFyRef.current = fy
      setTargetFy((cur) => (cur === prevFy ? fy : cur))
    }

    sync()
    const id = window.setInterval(sync, INTERVAL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fiscalYearStartMonth, setTargetFy])
}
