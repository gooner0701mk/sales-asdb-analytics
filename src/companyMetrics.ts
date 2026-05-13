import type {
  ActivityLog,
  ActivityType,
  LeadSource,
  UserMilestones,
} from './types'

/** 飛び込み・テレアポをアプローチ種別とみなす */
export function isApproachActivityType(t: ActivityType): boolean {
  return t === 'coldVisit' || t === 'teleAppo'
}

const ZERO_WIDTH = /[\u200b-\u200d\ufeff]/g

/** 企業名の突き合わせ用（不可視文字除去・NFKC・空白・大小文字を無視） */
export function normalizeCompanyKey(name: string): string {
  return name
    .trim()
    .replace(ZERO_WIDTH, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** 法人格表記を除いたコア名（表記ゆれの補助。短すぎるときは使わない） */
function canonicalCompanyCore(name: string): string {
  let s = normalizeCompanyKey(name)
  s = s
    .replace(/^株式会社\s*/, '')
    .replace(/\s*株式会社$/, '')
    .replace(/^\(株\)\s*/, '')
    .replace(/\s*\(株\)$/, '')
    .replace(/^（株）\s*/, '')
    .replace(/\s*（株）$/, '')
    .replace(/^㈱\s*/, '')
    .replace(/\s*㈱$/, '')
  return s.replace(/\s+/g, ' ').trim()
}

/** 正規化後に同じ長さで文字位置が1か所だけ違う（例：グリーン建設↔グリーン電設） */
function namesLikelyOneCharTypo(a: string, b: string): boolean {
  const na = normalizeCompanyKey(a)
  const nb = normalizeCompanyKey(b)
  if (na.length !== nb.length) return false
  if (na.length < 4 || na.length > 32) return false
  let diff = 0
  for (let i = 0; i < na.length; i++) {
    if (na[i] !== nb[i]) diff++
    if (diff > 1) return false
  }
  return diff === 1
}

/** 活動ログと一覧の企業名が同一視できるか */
export function companyNamesMatchForSync(a: string, b: string): boolean {
  if (normalizeCompanyKey(a) === normalizeCompanyKey(b)) return true
  const ca = canonicalCompanyCore(a)
  const cb = canonicalCompanyCore(b)
  if (ca.length >= 2 && cb.length >= 2 && ca === cb) return true
  return namesLikelyOneCharTypo(a, b)
}

/**
 * 企業名が一致する活動のうち、種別を問わず最新の活動日（一覧の日付・経過用）。
 * 担当一致を優先し、無ければ他担当にフォールバック。
 */
export function inferLastActivityDateForCompany(
  activities: ActivityLog[],
  ownerUserId: string,
  companyName: string,
): string | null {
  if (!normalizeCompanyKey(companyName)) return null
  const rows = activities.filter((a) =>
    companyNamesMatchForSync(a.customerName, companyName),
  )
  if (rows.length === 0) return null
  const same = rows.filter((a) => a.userId === ownerUserId)
  const pool = same.length > 0 ? same : rows
  return pool.reduce((max, a) => (a.date > max ? a.date : max), pool[0]!.date)
}

/**
 * 企業に紐づく活動から流入経路を推定。
 * 担当一致の活動を優先し、無ければ他担当にフォールバック（日付の新しい順で最初の非null）。
 */
export function inferLeadSourceForCompany(
  activities: ActivityLog[],
  ownerUserId: string,
  companyName: string,
): LeadSource | null {
  if (!normalizeCompanyKey(companyName)) return null
  const rows = activities.filter((a) =>
    companyNamesMatchForSync(a.customerName, companyName),
  )
  if (rows.length === 0) return null
  const same = rows.filter((a) => a.userId === ownerUserId)
  const pool = same.length > 0 ? same : rows
  const sorted = [...pool].sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return b.id.localeCompare(a.id)
  })
  for (const a of sorted) {
    if (a.leadSource) return a.leadSource
  }
  return null
}

/** ログ上の「受注があった」最終日（活動日のうち orderCount>0 の最大） */
export function inferLastOrderDateFromActivities(
  activities: ActivityLog[],
): string | null {
  const rows = activities.filter((a) => a.orderCount > 0)
  if (rows.length === 0) return null
  return rows.reduce((max, a) => (a.date > max ? a.date : max), rows[0]!.date)
}

/** ログ上の飛び込み・テレアポの最終日 */
export function inferLastApproachDateFromActivities(
  activities: ActivityLog[],
): string | null {
  const rows = activities.filter((a) => isApproachActivityType(a.activityType))
  if (rows.length === 0) return null
  return rows.reduce((max, a) => (a.date > max ? a.date : max), rows[0]!.date)
}

/** 基準となる「前回受注日」（手入力を優先、未入力ならログ推定） */
export function effectiveCompanyLastOrderDate(
  company: UserMilestones,
  activities: ActivityLog[],
): string | null {
  return company.lastOrderDate ?? inferLastOrderDateFromActivities(activities)
}

/** 基準となる「前回アプローチ日」（手入力を優先、未入力ならログ推定） */
export function effectiveCompanyLastApproachDate(
  company: UserMilestones,
  activities: ActivityLog[],
): string | null {
  return (
    company.lastApproachDate ?? inferLastApproachDateFromActivities(activities)
  )
}

/** refOrder 日より後の、最初の飛び込み／テレアポ活動日 */
export function firstApproachAfter(
  activities: ActivityLog[],
  refOrderDate: string,
): string | null {
  const next = [...activities]
    .filter(
      (a) => isApproachActivityType(a.activityType) && a.date > refOrderDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  return next[0]?.date ?? null
}

export function daysBetweenInclusive(fromIso: string, toIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso))
    return null
  const [y1, m1, d1] = fromIso.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = toIso.split('-').map(Number) as [number, number, number]
  const t0 = new Date(y1, m1 - 1, d1).getTime()
  const t1 = new Date(y2, m2 - 1, d2).getTime()
  return Math.round((t1 - t0) / 86400000)
}
