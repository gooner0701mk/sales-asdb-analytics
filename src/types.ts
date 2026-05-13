import type { ChartColorPalette } from './chartColors'
import { DEFAULT_CHART_COLORS } from './chartColors'

/** 1回の営業活動ログ */
export type ActivityType = 'coldVisit' | 'teleAppo' | 'meeting' | 'reception'

/** 流入経路（活動の報告内容） */
export type LeadSource =
  | 'fromList'
  | 'fromBidResult'
  | 'fromConstructionSign'
  | 'fromSiteConnection'
  | 'fromReferral'
  | 'fromRequest'
  | 'fromExistingCustomer'

export const LEAD_SOURCES: readonly LeadSource[] = [
  'fromList',
  'fromBidResult',
  'fromConstructionSign',
  'fromSiteConnection',
  'fromReferral',
  'fromRequest',
  'fromExistingCustomer',
] as const

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  fromList: 'リストから',
  fromBidResult: '入札結果から',
  fromConstructionSign: '工事看板等から',
  fromSiteConnection: '現場の繋がりから',
  fromReferral: '紹介から',
  fromRequest: '依頼されて',
  fromExistingCustomer: '既存顧客',
}

export function parseLeadSource(raw: unknown): LeadSource | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  return (LEAD_SOURCES as readonly string[]).includes(s) ? (s as LeadSource) : null
}

const ACTIVITY_TYPES: readonly ActivityType[] = [
  'coldVisit',
  'teleAppo',
  'meeting',
  'reception',
] as const

function isActivityTypeString(s: unknown): s is ActivityType {
  return typeof s === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(s)
}

/** localStorage / JSON からの1件を ActivityLog に正規化。不正なら null */
export function normalizeStoredActivity(x: unknown): ActivityLog | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.userId !== 'string' ||
    typeof r.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    typeof r.customerName !== 'string' ||
    !isActivityTypeString(r.activityType)
  ) {
    return null
  }
  const q =
    typeof r.quoteCount === 'number'
      ? r.quoteCount
      : Number.parseInt(String(r.quoteCount ?? ''), 10)
  const o =
    typeof r.orderCount === 'number'
      ? r.orderCount
      : Number.parseInt(String(r.orderCount ?? ''), 10)
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    customerName: r.customerName,
    leadSource: parseLeadSource(r.leadSource),
    activityType: r.activityType,
    quoteCount: Number.isFinite(q) ? Math.max(0, Math.round(q)) : 0,
    orderCount: Number.isFinite(o) ? Math.max(0, Math.round(o)) : 0,
  }
}

export type User = {
  id: string
  name: string
}

export type UserMilestones = {
  lastApproachDate: string | null
  lastOrderDate: string | null
}

export type ActivityLog = {
  id: string
  /** 担当ユーザー */
  userId: string
  /** 活動日 YYYY-MM-DD */
  date: string
  customerName: string
  /** 流入経路。未設定は null */
  leadSource: LeadSource | null
  activityType: ActivityType
  /** この活動に紐づく見積もり件数（0以上の整数） */
  quoteCount: number
  /** この活動に紐づく受注件数（0以上の整数） */
  orderCount: number
}

/** 月次集計（グラフ用・活動ログから自動算出） */
export type MonthlyRecord = {
  id: string
  ym: string
  coldVisits: number
  teleAppo: number
  meetings: number
  /** 接待件数 */
  receptions: number
  quotes: number
  closedWon: number
}

/**
 * ダッシュボード・各タブで表示するデータの担当範囲。
 * `'all'` は全ユーザー。配列は含める userId のみ（複数可・自分を外して他担当のみも可）。
 * 空配列は「誰も選んでいない」＝該当データなし。
 */
export type DataViewUserIds = 'all' | string[]

/** アプローチ先企業マスタ（一覧タブ用） */
export type ApproachTarget = {
  id: string
  companyName: string
  /** 主担当ユーザー */
  ownerUserId: string
  /** 前回アプローチ日 YYYY-MM-DD */
  lastApproachDate: string | null
}

export function newApproachTarget(
  companyName: string,
  ownerUserId: string,
  lastApproachDate: string | null = null,
): ApproachTarget {
  return {
    id: crypto.randomUUID(),
    companyName: companyName.trim() || '（名称なし）',
    ownerUserId,
    lastApproachDate,
  }
}

/** 売上データ（請求ベース）の1件 */
export type Invoice = {
  id: string
  /** 請求日 YYYY-MM-DD */
  invoiceDate: string
  /** 取引先（請求先） */
  clientName: string
  /** 請求金額（円・整数） */
  amountYen: number
  /** 担当ユーザー */
  userId: string
  /** メモ（任意） */
  memo: string
}

export function newInvoice(
  userId: string,
  invoiceDate: string,
  clientName: string,
  amountYen: number,
  memo = '',
): Invoice {
  return {
    id: crypto.randomUUID(),
    invoiceDate,
    clientName: clientName.trim() || '（取引先なし）',
    amountYen: Math.max(0, Math.round(amountYen)),
    userId,
    memo: memo.trim(),
  }
}

/** 1年度分の会社・担当ごとの請求売上目標 */
export type InvoiceAnnualRevenueTargetBundle = {
  /** 各担当の年次目標の合計（保存時に自動設定。読込時も再計算で整合） */
  companyAnnualYen: number
  userAnnualYenById: Record<string, number>
}

export type CompanySettings = {
  /** 表示用の会社名 */
  companyName: string
  /** 会計年度の開始月 1–12（例: 3 = 3月始まり） */
  fiscalYearStartMonth: number
  /**
   * 期番号の基準: 会計年度開始年がこの年のとき「第 anchorFiscalTermNumber 期」とみなす。
   * 他年度は線形に増減（例: 基準が2024年第5期なら2023年開始は第4期）。
   */
  anchorFiscalYearStartYear: number
  anchorFiscalTermNumber: number
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: '',
  fiscalYearStartMonth: 3,
  anchorFiscalYearStartYear: 2024,
  anchorFiscalTermNumber: 1,
}

export type AppState = {
  version: 8
  users: User[]
  /** 会社名・会計年度・期番号の表示設定 */
  companySettings: CompanySettings
  /** 活動の登録者・「自分」の集計に使うユーザー */
  sessionUserId: string | null
  /** 表示データの絞り込み（全員 or 複数の userId）。活動の追加は常に session ユーザー */
  dataViewUserIds: DataViewUserIds
  activities: ActivityLog[]
  milestonesByUser: Record<string, UserMilestones>
  /** 会社全体の前回アプローチ日・前回受注日（手入力。グラフの補助） */
  companyMilestones: UserMilestones
  /** アプローチ先企業一覧 */
  approachTargets: ApproachTarget[]
  /** 売上データ（請求ベース）の請求一覧 */
  invoices: Invoice[]
  /**
   * 売上データ（請求ベース）の年次売上目標（円）。キーは 3月始まり年度の開始年（例: "2025"）。
   * 各担当の userAnnualYenById の合計が companyAnnualYen に保存される。
   */
  invoiceAnnualRevenueTargets: Record<string, InvoiceAnnualRevenueTargetBundle>
  /** ダッシュボードのグラフ色（ブラウザに保存） */
  chartColors: ChartColorPalette
}

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  coldVisit: '飛び込み',
  teleAppo: 'テレアポ',
  meeting: '商談',
  reception: '接待',
}

export function newUser(name: string): User {
  return { id: crypto.randomUUID(), name: name.trim() || '無名' }
}

export function emptyMilestones(): UserMilestones {
  return { lastApproachDate: null, lastOrderDate: null }
}

export function emptyState(): AppState {
  const u = newUser('担当者1')
  return {
    version: 8,
    users: [u],
    companySettings: { ...DEFAULT_COMPANY_SETTINGS },
    sessionUserId: u.id,
    dataViewUserIds: [u.id],
    activities: [],
    milestonesByUser: { [u.id]: emptyMilestones() },
    companyMilestones: emptyMilestones(),
    approachTargets: [],
    invoices: [],
    invoiceAnnualRevenueTargets: {},
    chartColors: { ...DEFAULT_CHART_COLORS },
  }
}
