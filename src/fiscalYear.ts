/** 会計年度の開始月（1–12）から、暦月 YYYY-MM が属する「年度開始年」を求める */
export function fyStartYearFromCalendarYm(ym: string, fiscalStartMonth: number): number {
  const sm = Math.max(1, Math.min(12, Math.round(fiscalStartMonth))) || 3
  const [ys, ms] = ym.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return y
  return m >= sm ? y : y - 1
}

/** 会計年度の表示ラベル（例: 2025年3月～2026年2月） */
export function fiscalYearRangeLabel(fyStartYear: number, fiscalStartMonth: number): string {
  const sm = Math.max(1, Math.min(12, Math.round(fiscalStartMonth))) || 3
  if (sm === 1) {
    return `${fyStartYear}年1月～${fyStartYear}年12月`
  }
  const endM = sm - 1
  const endY = fyStartYear + 1
  return `${fyStartYear}年${sm}月～${endY}年${endM}月`
}

/** 請求・活動日 YYYY-MM-DD の範囲 [lo, hiEx) */
export function fiscalYearDateRangeIso(
  fyStartYear: number,
  fiscalStartMonth: number,
): { lo: string; hiEx: string } {
  const sm = Math.max(1, Math.min(12, Math.round(fiscalStartMonth))) || 3
  const lo = `${fyStartYear}-${String(sm).padStart(2, '0')}-01`
  const nextFy = fyStartYear + 1
  const hiEx = `${nextFy}-${String(sm).padStart(2, '0')}-01`
  return { lo, hiEx }
}

/** 年度開始年 fyStartYear の「第何期」か（アンカーからの差分） */
export function fiscalTermNumberForStartYear(
  fyStartYear: number,
  anchorFiscalYearStartYear: number,
  anchorFiscalTermNumber: number,
): number {
  return anchorFiscalTermNumber + (fyStartYear - anchorFiscalYearStartYear)
}
