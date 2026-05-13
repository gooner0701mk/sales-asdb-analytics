import {
  companyNamesMatchForSync,
  inferLastActivityDateForCompany,
  normalizeCompanyKey,
} from './companyMetrics'
import { daysElapsedSince } from './dates'
import { newApproachTarget, type ActivityLog, type ApproachTarget } from './types'

function pickLatestIso(a: string | null, b: string | null): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return a >= b ? a : b
}

/**
 * 活動ログから推定した最新日（種別は問わない）と、一覧に保存されている日付のうち新しい方を採用する。
 */
export function mergeApproachTargetsWithActivityLog(
  targets: ApproachTarget[],
  activities: ActivityLog[],
): ApproachTarget[] {
  return targets.map((t) => {
    const inferred = inferLastActivityDateForCompany(
      activities,
      t.ownerUserId,
      t.companyName,
    )
    const next = pickLatestIso(t.lastApproachDate, inferred)
    return next === t.lastApproachDate ? t : { ...t, lastApproachDate: next }
  })
}

/**
 * 既存行の「前回アプローチ日」を活動ログの最新日とマージし、
 * 活動に出てくるが一覧にまだない（担当＋企業名）の行を追加する。
 * 行の追加・日付は活動種別を問わない（手入力より新しい活動日を採用）。
 */
function targetListCoversActivity(
  targets: ApproachTarget[],
  ownerUserId: string,
  activityCustomerName: string,
): boolean {
  return targets.some(
    (t) =>
      t.ownerUserId === ownerUserId &&
      companyNamesMatchForSync(t.companyName, activityCustomerName),
  )
}

export function syncApproachTargetsFromActivities(
  targets: ApproachTarget[],
  activities: ActivityLog[],
): ApproachTarget[] {
  const withDates = mergeApproachTargetsWithActivityLog(targets, activities)

  const latestAnyByKey = new Map<
    string,
    { ownerUserId: string; displayName: string; lastDate: string }
  >()
  for (const a of activities) {
    const nk = normalizeCompanyKey(a.customerName)
    if (!nk) continue
    const key = `${a.userId}\t${nk}`
    const cur = latestAnyByKey.get(key)
    if (!cur || a.date > cur.lastDate) {
      latestAnyByKey.set(key, {
        ownerUserId: a.userId,
        displayName: a.customerName.trim() || '（名称なし）',
        lastDate: a.date,
      })
    }
  }

  const ordered = [...latestAnyByKey.values()].sort((a, b) => {
    const u = a.ownerUserId.localeCompare(b.ownerUserId)
    return u !== 0
      ? u
      : normalizeCompanyKey(a.displayName).localeCompare(
          normalizeCompanyKey(b.displayName),
        )
  })

  const combined: ApproachTarget[] = [...withDates]
  for (const v of ordered) {
    if (targetListCoversActivity(combined, v.ownerUserId, v.displayName)) continue
    combined.push(newApproachTarget(v.displayName, v.ownerUserId, null))
  }

  return mergeApproachTargetsWithActivityLog(combined, activities)
}

/** 一覧が同一か（同期ループ防止。id・担当・企業名・前回アプローチ日で比較） */
export function approachTargetsListEqual(
  prev: ApproachTarget[],
  next: ApproachTarget[],
): boolean {
  if (prev.length !== next.length) return false
  const bm = new Map(next.map((t) => [t.id, t]))
  for (const t of prev) {
    const o = bm.get(t.id)
    if (!o) return false
    if (
      o.companyName !== t.companyName ||
      o.ownerUserId !== t.ownerUserId ||
      o.lastApproachDate !== t.lastApproachDate
    ) {
      return false
    }
  }
  return true
}

/** 経過日数の大きい順（未設定は末尾） */
export function sortTargetsByElapsedDesc(targets: ApproachTarget[]): ApproachTarget[] {
  return [...targets].sort((a, b) => {
    const da = daysElapsedSince(a.lastApproachDate)
    const db = daysElapsedSince(b.lastApproachDate)
    if (da === null && db === null) return a.companyName.localeCompare(b.companyName)
    if (da === null) return 1
    if (db === null) return -1
    return db - da
  })
}
