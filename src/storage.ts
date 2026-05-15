import { mergeChartColors } from './chartColors'
import { normalizeStoredInvoice } from './normalizeInvoice'
import type {
  ActivityLog,
  ApproachTarget,
  AppState,
  DataViewUserIds,
  EstimateTask,
  Invoice,
  InvoiceAnnualRevenueTargetBundle,
  User,
  UserMilestones,
} from './types'
import { createId } from './createId'
import { isoDaysAgo } from './dates'
import {
  ACTIVITY_TYPES_ORDER,
  DEFAULT_COMPANY_SETTINGS,
  defaultLeadSourceCatalog,
  emptyState,
  newApproachTarget,
  newUser,
  normalizeLeadSourceCatalog,
  normalizeStoredActivity,
  normalizeStoredEstimateTask,
  type ActivityType,
  type CompanySettings,
} from './types'

const STORAGE_KEY_V8 = 'sales-newbiz-v8'
const STORAGE_KEY_V7 = 'sales-newbiz-v7'
const STORAGE_KEY_V6 = 'sales-newbiz-v6'
const STORAGE_KEY_V5 = 'sales-newbiz-v5'
const LEGACY_V4_KEY = 'sales-newbiz-v4'

type AppStateV4 = {
  version: 4
  activities: Omit<ActivityLog, 'userId'>[]
  lastApproachDate: string | null
  lastOrderDate: string | null
}

function migrateV4ToCurrent(v4: AppStateV4): AppState {
  const u = newUser('担当者（移行）')
  const milestones: Record<string, UserMilestones> = {
    [u.id]: {
      lastApproachDate: v4.lastApproachDate,
      lastOrderDate: v4.lastOrderDate,
    },
  }
  const leadCat = defaultLeadSourceCatalog()
  const leadSet = new Set(leadCat.map((c) => c.id))
  const activities: ActivityLog[] = v4.activities
    .map((a) => normalizeStoredActivity({ ...a, userId: u.id }, leadSet))
    .filter((x): x is ActivityLog => x !== null)

  return {
    version: 8,
    users: [u],
    leadSourceCatalog: leadCat,
    activityTypeLabels: {},
    sessionUserId: u.id,
    dataViewUserIds: [u.id],
    activities,
    milestonesByUser: milestones,
    companyMilestones: {
      lastApproachDate: v4.lastApproachDate,
      lastOrderDate: v4.lastOrderDate,
    },
    approachTargets: [],
    invoices: [],
    invoiceAnnualRevenueTargets: {},
    companySettings: { ...DEFAULT_COMPANY_SETTINGS },
    chartColors: mergeChartColors(undefined),
    estimateTasks: [],
  }
}

function parseCompanySettings(o: Record<string, unknown>): CompanySettings {
  const raw = o.companySettings
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_COMPANY_SETTINGS }
  }
  const r = raw as Record<string, unknown>
  const companyName = typeof r.companyName === 'string' ? r.companyName.trim() : ''
  const smRaw =
    typeof r.fiscalYearStartMonth === 'number' && Number.isFinite(r.fiscalYearStartMonth)
      ? Math.round(r.fiscalYearStartMonth)
      : Number.parseInt(String(r.fiscalYearStartMonth ?? '3'), 10)
  const fiscalYearStartMonth = Math.max(
    1,
    Math.min(12, Number.isFinite(smRaw) ? smRaw : 3),
  )
  const ayRaw =
    typeof r.anchorFiscalYearStartYear === 'number'
      ? r.anchorFiscalYearStartYear
      : Number.parseInt(String(r.anchorFiscalYearStartYear ?? '2024'), 10)
  const anchorFiscalYearStartYear = Number.isFinite(ayRaw) ? Math.round(ayRaw) : 2024
  const atRaw =
    typeof r.anchorFiscalTermNumber === 'number'
      ? r.anchorFiscalTermNumber
      : Number.parseInt(String(r.anchorFiscalTermNumber ?? '1'), 10)
  const anchorFiscalTermNumber = Number.isFinite(atRaw) ? Math.max(1, Math.round(atRaw)) : 1
  return {
    companyName,
    fiscalYearStartMonth,
    anchorFiscalYearStartYear,
    anchorFiscalTermNumber,
  }
}

function parseInvoiceAnnualRevenueTargets(
  o: Record<string, unknown>,
): Record<string, InvoiceAnnualRevenueTargetBundle> {
  const raw = o.invoiceAnnualRevenueTargets
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, InvoiceAnnualRevenueTargetBundle> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const fy = Number.parseInt(k, 10)
    if (!Number.isFinite(fy)) continue
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const r = v as Record<string, unknown>
    const userAnnualYenById: Record<string, number> = {}
    const uMap = r.userAnnualYenById
    if (uMap && typeof uMap === 'object' && !Array.isArray(uMap)) {
      for (const [uid, val] of Object.entries(uMap as Record<string, unknown>)) {
        if (typeof uid !== 'string') continue
        const n =
          typeof val === 'number' && Number.isFinite(val)
            ? val
            : Number.parseInt(String(val ?? '0').replace(/[,，]/g, ''), 10)
        if (Number.isFinite(n)) userAnnualYenById[uid] = Math.max(0, Math.round(n))
      }
    }
    const sumUsers = Object.values(userAnnualYenById).reduce((a, b) => a + b, 0)
    out[String(fy)] = { companyAnnualYen: sumUsers, userAnnualYenById }
  }
  return out
}

function parseInvoicesFromRecord(o: Record<string, unknown>): Invoice[] {
  const raw = o.invoices
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => normalizeStoredInvoice(x))
    .filter((x): x is Invoice => x !== null)
}

function parseEstimateTasksFromRecord(
  o: Record<string, unknown>,
  users: User[],
): EstimateTask[] {
  const raw = o.estimateTasks
  if (!Array.isArray(raw)) return []
  const userIds = new Set(users.map((u) => u.id))
  return raw
    .map((x) => normalizeStoredEstimateTask(x))
    .filter(
      (t): t is EstimateTask =>
        t !== null && t.assigneeUserId !== '' && userIds.has(t.assigneeUserId),
    )
}

function normalizeDataViewUserIds(
  o: Record<string, unknown>,
  users: User[],
  sessionUserId: string | null,
): DataViewUserIds {
  const multi = o.dataViewUserIds
  if (multi === 'all') return 'all'
  if (Array.isArray(multi)) {
    const ids = multi.filter(
      (x): x is string => typeof x === 'string' && users.some((u) => u.id === x),
    )
    if (users.length > 0 && ids.length >= users.length) return 'all'
    if (ids.length > 0) return ids
    if (multi.length === 0) return []
  }
  const single = o.dataViewUserId
  if (single === 'all') return 'all'
  if (typeof single === 'string' && users.some((u) => u.id === single)) return [single]
  const vs = o.viewScope
  if (vs === 'all') return 'all'
  if (
    typeof sessionUserId === 'string' &&
    users.some((u) => u.id === sessionUserId)
  ) {
    return [sessionUserId]
  }
  return users[0]?.id ? [users[0].id] : 'all'
}

function parseActivityTypeLabels(
  raw: unknown,
): Partial<Record<ActivityType, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: Partial<Record<ActivityType, string>> = {}
  for (const t of ACTIVITY_TYPES_ORDER) {
    const v = r[t]
    if (typeof v === 'string' && v.trim()) out[t] = v.trim()
  }
  return out
}

/** v5 以降の生 JSON を正規化（常に v8） */
export function normalizeStoredStateRecord(o: Record<string, unknown>): AppState {
  const users = (o.users as User[]) ?? []
  const sessionUserId =
    typeof o.sessionUserId === 'string' || o.sessionUserId === null
      ? (o.sessionUserId as string | null)
      : null
  const leadSourceCatalog = normalizeLeadSourceCatalog(o.leadSourceCatalog)
  const leadSourceIdSet = new Set(leadSourceCatalog.map((x) => x.id))
  const rawActs = (o.activities as unknown[]) ?? []
  const activities: ActivityLog[] = rawActs
    .map((x) => normalizeStoredActivity(x, leadSourceIdSet))
    .filter((a): a is ActivityLog => a !== null)
  const milestonesByUser =
    (o.milestonesByUser as Record<string, UserMilestones>) ?? {}
  const companyRaw = o.companyMilestones as UserMilestones | undefined
  const companyMilestones: UserMilestones =
    companyRaw &&
    (companyRaw.lastApproachDate === null ||
      typeof companyRaw.lastApproachDate === 'string') &&
    (companyRaw.lastOrderDate === null || typeof companyRaw.lastOrderDate === 'string')
      ? {
          lastApproachDate: companyRaw.lastApproachDate,
          lastOrderDate: companyRaw.lastOrderDate,
        }
      : { lastApproachDate: null, lastOrderDate: null }

  const approachTargets: ApproachTarget[] = Array.isArray(o.approachTargets)
    ? (o.approachTargets as ApproachTarget[])
    : []

  const invoices = parseInvoicesFromRecord(o)
  const invoiceAnnualRevenueTargets = parseInvoiceAnnualRevenueTargets(o)
  const companySettings = parseCompanySettings(o)
  const estimateTasks = parseEstimateTasksFromRecord(o, users)

  let dataViewUserIds = normalizeDataViewUserIds(o, users, sessionUserId)
  if (dataViewUserIds !== 'all') {
    dataViewUserIds = dataViewUserIds.filter((id) => users.some((u) => u.id === id))
  }

  return {
    version: 8,
    users,
    leadSourceCatalog,
    activityTypeLabels: parseActivityTypeLabels(o.activityTypeLabels),
    sessionUserId,
    dataViewUserIds,
    activities,
    milestonesByUser,
    companyMilestones,
    approachTargets,
    invoices,
    invoiceAnnualRevenueTargets,
    companySettings,
    chartColors: mergeChartColors(o.chartColors),
    estimateTasks,
  }
}

export function loadState(): AppState | null {
  try {
    const rawV8 = localStorage.getItem(STORAGE_KEY_V8)
    if (rawV8) {
      const p = JSON.parse(rawV8) as unknown
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (o.version !== 8 || !Array.isArray(o.activities)) return null
      return normalizeStoredStateRecord(o)
    }

    const rawV7 = localStorage.getItem(STORAGE_KEY_V7)
    if (rawV7) {
      const p = JSON.parse(rawV7) as unknown
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (o.version !== 7 || !Array.isArray(o.activities)) return null
      const next = normalizeStoredStateRecord(o)
      saveState(next)
      localStorage.removeItem(STORAGE_KEY_V7)
      return next
    }

    const rawV6 = localStorage.getItem(STORAGE_KEY_V6)
    if (rawV6) {
      const p = JSON.parse(rawV6) as unknown
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (o.version !== 6 || !Array.isArray(o.activities)) return null
      const next = normalizeStoredStateRecord(o)
      saveState(next)
      localStorage.removeItem(STORAGE_KEY_V6)
      return next
    }

    const rawV5 = localStorage.getItem(STORAGE_KEY_V5)
    if (rawV5) {
      const p = JSON.parse(rawV5) as unknown
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (o.version !== 5 || !Array.isArray(o.activities)) return null
      const next = normalizeStoredStateRecord(o)
      saveState(next)
      localStorage.removeItem(STORAGE_KEY_V5)
      return next
    }

    const legacy = localStorage.getItem(LEGACY_V4_KEY)
    if (legacy) {
      const v4 = JSON.parse(legacy) as AppStateV4
      if (v4 && v4.version === 4 && Array.isArray(v4.activities)) {
        const next = migrateV4ToCurrent(v4)
        saveState(next)
        return next
      }
    }
  } catch {
    return null
  }
  return null
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY_V8, JSON.stringify(state))
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY_V8)
  localStorage.removeItem(STORAGE_KEY_V7)
  localStorage.removeItem(STORAGE_KEY_V6)
  localStorage.removeItem(STORAGE_KEY_V5)
  localStorage.removeItem(LEGACY_V4_KEY)
}

export function sampleState(): AppState {
  const yamada = newUser('山田')
  const sato = newUser('佐藤')
  const mk = (
    userId: string,
    daysAgo: number,
    customerName: string,
    activityType: ActivityLog['activityType'],
    quoteCount: number,
    orderCount: number,
    leadSource: string | null = null,
  ): ActivityLog => ({
    id: createId(),
    userId,
    date: isoDaysAgo(daysAgo),
    customerName,
    leadSource,
    activityType,
    quoteCount,
    orderCount,
  })

  const activities: ActivityLog[] = [
    mk(yamada.id, 1, '株式会社アルファ', 'teleAppo', 0, 0, 'fromList'),
    mk(yamada.id, 2, 'テック商事', 'coldVisit', 0, 0, 'fromConstructionSign'),
    mk(sato.id, 2, 'イースト商事', 'meeting', 1, 0, 'fromReferral'),
    mk(yamada.id, 3, 'スカイ工業', 'meeting', 1, 0, 'fromSiteConnection'),
    mk(sato.id, 4, '北陸ロジ', 'teleAppo', 0, 0, 'fromBidResult'),
    mk(yamada.id, 5, 'グリーン建設', 'meeting', 0, 1, 'fromRequest'),
    mk(sato.id, 6, 'オーシャン食品', 'teleAppo', 1, 0, null),
    mk(yamada.id, 8, '中央スチール', 'coldVisit', 0, 0, 'fromList'),
    mk(sato.id, 10, 'フジパーツ', 'meeting', 2, 0, 'fromReferral'),
    mk(yamada.id, 12, 'リンクス', 'teleAppo', 0, 0, null),
    mk(sato.id, 14, 'サンライズ', 'meeting', 0, 0, 'fromSiteConnection'),
    mk(yamada.id, 18, 'メイプル建設', 'meeting', 1, 1, 'fromRequest'),
    mk(sato.id, 22, 'イースト物流', 'coldVisit', 0, 0, 'fromConstructionSign'),
    mk(yamada.id, 7, 'グリーン建設', 'reception', 0, 0, 'fromRequest'),
    mk(sato.id, 9, 'フジパーツ', 'reception', 0, 0, 'fromReferral'),
    mk(yamada.id, 11, 'リンクス', 'reception', 0, 0, null),
  ]

  const mkInv = (
    userId: string,
    daysAgo: number,
    clientName: string,
    amountYen: number,
  ): Invoice => ({
    id: createId(),
    invoiceDate: isoDaysAgo(daysAgo),
    clientName,
    amountYen,
    userId,
    memo: '',
  })

  const invoices: Invoice[] = [
    mkInv(yamada.id, 3, '株式会社アルファ', 880000),
    mkInv(sato.id, 4, '株式会社アルファ', 420000),
    mkInv(yamada.id, 6, 'グリーン建設', 1250000),
    mkInv(sato.id, 8, 'フジパーツ', 310000),
    mkInv(sato.id, 10, 'グリーン建設', 560000),
    mkInv(yamada.id, 12, 'テック商事', 198000),
  ]

  return {
    version: 8,
    users: [yamada, sato],
    leadSourceCatalog: defaultLeadSourceCatalog(),
    activityTypeLabels: {},
    sessionUserId: yamada.id,
    dataViewUserIds: [yamada.id],
    activities,
    invoices,
    chartColors: mergeChartColors(undefined),
    companySettings: { ...DEFAULT_COMPANY_SETTINGS },
    milestonesByUser: {
      [yamada.id]: {
        lastApproachDate: isoDaysAgo(3),
        lastOrderDate: isoDaysAgo(16),
      },
      [sato.id]: {
        lastApproachDate: isoDaysAgo(5),
        lastOrderDate: isoDaysAgo(20),
      },
    },
    companyMilestones: {
      lastApproachDate: isoDaysAgo(1),
      lastOrderDate: isoDaysAgo(18),
    },
    approachTargets: [
      newApproachTarget('株式会社アルファ', yamada.id, isoDaysAgo(25)),
      newApproachTarget('テック商事', yamada.id, isoDaysAgo(8)),
      newApproachTarget('スカイ工業', yamada.id, isoDaysAgo(3)),
      newApproachTarget('北陸ロジ', sato.id, isoDaysAgo(30)),
      newApproachTarget('フジパーツ', sato.id, null),
    ],
    invoiceAnnualRevenueTargets: {},
    estimateTasks: [
      {
        id: createId(),
        projectName: '期限超過（点滅）',
        customerName: '中央スチール',
        customerContact: '鈴木',
        assigneeUserId: yamada.id,
        deadline: isoDaysAgo(2),
        completed: false,
        completedAt: null,
      },
      {
        id: createId(),
        projectName: '提出当日（点滅）',
        customerName: 'イースト商事',
        customerContact: '高橋主任',
        assigneeUserId: sato.id,
        deadline: isoDaysAgo(0),
        completed: false,
        completedAt: null,
      },
      {
        id: createId(),
        projectName: '1日前（赤）',
        customerName: 'グリーン建設',
        customerContact: '佐藤',
        assigneeUserId: yamada.id,
        deadline: isoDaysAgo(-1),
        completed: false,
        completedAt: null,
      },
      {
        id: createId(),
        projectName: '2日前（黄）',
        customerName: 'サンプル商事',
        customerContact: '田中',
        assigneeUserId: sato.id,
        deadline: isoDaysAgo(-2),
        completed: false,
        completedAt: null,
      },
      {
        id: createId(),
        projectName: '3日前（黄）',
        customerName: 'フジパーツ',
        customerContact: '山本',
        assigneeUserId: sato.id,
        deadline: isoDaysAgo(-3),
        completed: false,
        completedAt: null,
      },
      {
        id: createId(),
        projectName: '既に提出済',
        customerName: 'テック商事',
        customerContact: '伊藤',
        assigneeUserId: yamada.id,
        deadline: isoDaysAgo(10),
        completed: true,
        completedAt: isoDaysAgo(2),
      },
    ],
  }
}

export function initialState(): AppState {
  return loadState() ?? sampleState()
}

export { emptyState }
