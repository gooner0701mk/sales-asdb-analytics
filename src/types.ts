import type { ChartColorPalette } from './chartColors'
import { DEFAULT_CHART_COLORS } from './chartColors'
import { createId } from './createId'

/** 既定の営業種類 id（互換・CSV） */
export type BuiltinActivityTypeId =
  | 'coldVisit'
  | 'teleAppo'
  | 'meeting'
  | 'reception'

/** 活動ログの activityType はカタログの id（文字列） */
export type ActivityType = string

export const BUILTIN_ACTIVITY_IDS: readonly BuiltinActivityTypeId[] = [
  'coldVisit',
  'teleAppo',
  'meeting',
  'reception',
] as const

/** 転換率・「アプローチ件数」集計での扱い */
export type ActivityAnalysisRole = 'approach' | 'meeting' | 'reception' | 'general'

export type ActivityTypeCatalogItem = {
  id: string
  label: string
  role: ActivityAnalysisRole
}

const DEFAULT_ACTIVITY_ROLE: Record<BuiltinActivityTypeId, ActivityAnalysisRole> = {
  coldVisit: 'approach',
  teleAppo: 'approach',
  meeting: 'meeting',
  reception: 'reception',
}

export const ACTIVITY_TYPE_LABEL: Record<BuiltinActivityTypeId, string> = {
  coldVisit: '飛び込み',
  teleAppo: 'テレアポ',
  meeting: '商談',
  reception: '接待',
}

export const ACTIVITY_TYPES_ORDER: readonly BuiltinActivityTypeId[] = [
  'coldVisit',
  'teleAppo',
  'meeting',
  'reception',
] as const

export function defaultActivityTypeCatalog(): ActivityTypeCatalogItem[] {
  return BUILTIN_ACTIVITY_IDS.map((id) => ({
    id,
    label: ACTIVITY_TYPE_LABEL[id],
    role: DEFAULT_ACTIVITY_ROLE[id],
  }))
}

function parseActivityAnalysisRole(raw: unknown): ActivityAnalysisRole {
  if (raw === 'approach' || raw === 'meeting' || raw === 'reception' || raw === 'general')
    return raw
  return 'general'
}

/**
 * 営業種類カタログを正規化。
 * 旧 `activityTypeLabels` は表示名のマージにのみ使う。
 */
export function normalizeActivityTypeCatalog(
  rawCatalog: unknown,
  legacyLabels: unknown,
): ActivityTypeCatalogItem[] {
  const labelOverrides: Record<string, unknown> =
    legacyLabels && typeof legacyLabels === 'object' && !Array.isArray(legacyLabels)
      ? (legacyLabels as Record<string, unknown>)
      : {}
  const mergeLabel = (id: string, def: string) => {
    const o = labelOverrides[id]
    return typeof o === 'string' && o.trim() ? o.trim() : def
  }

  if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) {
    return defaultActivityTypeCatalog().map((row) => ({
      ...row,
      label: mergeLabel(row.id, row.label),
    }))
  }

  const parsed: ActivityTypeCatalogItem[] = []
  const seen = new Set<string>()
  for (const x of rawCatalog) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (!id || seen.has(id)) continue
    const builtin = (BUILTIN_ACTIVITY_IDS as readonly string[]).includes(id)
    const defLab = (ACTIVITY_TYPE_LABEL as Record<string, string>)[id] ?? id
    const label =
      typeof r.label === 'string' && r.label.trim() ? r.label.trim() : defLab
    let role = parseActivityAnalysisRole(r.role)
    if (builtin) {
      role = DEFAULT_ACTIVITY_ROLE[id as BuiltinActivityTypeId] ?? role
    }
    seen.add(id)
    parsed.push({ id, label: mergeLabel(id, label), role })
  }

  const byId = new Map(parsed.map((p) => [p.id, p]))
  const head: ActivityTypeCatalogItem[] = []
  for (const bid of BUILTIN_ACTIVITY_IDS) {
    const hit = byId.get(bid)
    head.push(
      hit
        ? {
            ...hit,
            label: mergeLabel(bid, hit.label),
            role: DEFAULT_ACTIVITY_ROLE[bid],
          }
        : {
            id: bid,
            label: mergeLabel(bid, ACTIVITY_TYPE_LABEL[bid]),
            role: DEFAULT_ACTIVITY_ROLE[bid],
          },
    )
  }
  const tail = parsed.filter(
    (p) => !(BUILTIN_ACTIVITY_IDS as readonly string[]).includes(p.id),
  )
  return [...head, ...tail]
}

export function labelForActivityTypeId(
  catalog: ActivityTypeCatalogItem[],
  id: string,
): string {
  const row = catalog.find((c) => c.id === id)
  return row?.label ?? id
}

/** localStorage / JSON からの1件を ActivityLog に正規化。不正なら null */
export function normalizeStoredActivity(
  x: unknown,
  leadSourceIdSet: Set<string>,
  activityTypeIdSet: Set<string>,
  fallbackActivityTypeId: string,
): ActivityLog | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.userId !== 'string' ||
    typeof r.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    typeof r.customerName !== 'string' ||
    typeof r.activityType !== 'string'
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
  let leadSource: string | null = null
  const ls = r.leadSource
  if (ls !== null && ls !== undefined && typeof ls === 'string') {
    const t = ls.trim()
    if (t && leadSourceIdSet.has(t)) leadSource = t
  }
  const atRaw = r.activityType.trim()
  const activityType = activityTypeIdSet.has(atRaw)
    ? atRaw
    : activityTypeIdSet.has(fallbackActivityTypeId)
      ? fallbackActivityTypeId
      : [...activityTypeIdSet][0] ?? 'meeting'
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    customerName: r.customerName,
    leadSource,
    activityType,
    quoteCount: Number.isFinite(q) ? Math.max(0, Math.round(q)) : 0,
    orderCount: Number.isFinite(o) ? Math.max(0, Math.round(o)) : 0,
  }
}
export type BuiltinLeadSourceId =
  | 'fromList'
  | 'fromBidResult'
  | 'fromConstructionSign'
  | 'fromSiteConnection'
  | 'fromReferral'
  | 'fromRequest'
  | 'fromExistingCustomer'

/** @deprecated 活動ログでは string（カタログ id）を使用 */
export type LeadSource = BuiltinLeadSourceId

export const LEAD_SOURCES: readonly BuiltinLeadSourceId[] = [
  'fromList',
  'fromBidResult',
  'fromConstructionSign',
  'fromSiteConnection',
  'fromReferral',
  'fromRequest',
  'fromExistingCustomer',
] as const

export const LEAD_SOURCE_LABEL: Record<BuiltinLeadSourceId, string> = {
  fromList: 'リストから',
  fromBidResult: '入札結果から',
  fromConstructionSign: '工事看板等から',
  fromSiteConnection: '現場の繋がりから',
  fromReferral: '紹介から',
  fromRequest: '依頼されて',
  fromExistingCustomer: '既存顧客',
}

/** 活動フォーム・集計で使う選択肢（id + 表示名） */
export type SelectOptionItem = { id: string; label: string }

export function defaultLeadSourceCatalog(): SelectOptionItem[] {
  return LEAD_SOURCES.map((id) => ({ id, label: LEAD_SOURCE_LABEL[id] }))
}

/** 表示用ラベル（カタログに無い id はそのまま表示） */
export function labelForLeadSourceId(
  catalog: SelectOptionItem[],
  id: string | null,
): string {
  if (id == null || id === '') return '―'
  const row = catalog.find((c) => c.id === id)
  return row?.label ?? id
}

/** 既定の7件＋保存済みの追加行をマージ（既定 id の欠落を防ぐ） */
export function normalizeLeadSourceCatalog(raw: unknown): SelectOptionItem[] {
  const fromDefaults = () => defaultLeadSourceCatalog()
  if (!Array.isArray(raw) || raw.length === 0) return fromDefaults()
  const parsed: SelectOptionItem[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (!id || seen.has(id)) continue
    const label =
      typeof r.label === 'string' && r.label.trim() ? r.label.trim() : id
    seen.add(id)
    parsed.push({ id, label })
  }
  const byId = new Map(parsed.map((p) => [p.id, p]))
  const head: SelectOptionItem[] = []
  for (const bid of LEAD_SOURCES) {
    head.push(byId.get(bid) ?? { id: bid, label: LEAD_SOURCE_LABEL[bid] })
  }
  const tail = parsed.filter((p) => !(LEAD_SOURCES as readonly string[]).includes(p.id))
  return [...head, ...tail]
}

export function parseLeadSource(raw: unknown): BuiltinLeadSourceId | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  return (LEAD_SOURCES as readonly string[]).includes(s) ? (s as BuiltinLeadSourceId) : null
}

/** CSV 等: 許可 id 集合に含まれる流入経路だけ通す */
export function parseLeadSourceIdForImport(
  raw: unknown,
  allowedIds: Set<string>,
): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  if (allowedIds.has(s)) return s
  return null
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
  /** 流入経路（leadSourceCatalog の id）。未設定は null */
  leadSource: string | null
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
  /** 営業種類 id ごとの件数 */
  activityCounts: Record<string, number>
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
    id: createId(),
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
    id: createId(),
    invoiceDate,
    clientName: clientName.trim() || '（取引先なし）',
    amountYen: Math.max(0, Math.round(amountYen)),
    userId,
    memo: memo.trim(),
  }
}

/** 見積書提出タスク（見積タブ） */
export type EstimateTask = {
  id: string
  /** 案件名 */
  projectName: string
  /** 顧客名 */
  customerName: string
  /** 顧客担当者 */
  customerContact: string
  /** 見積もり担当（社内ユーザー） */
  assigneeUserId: string
  /** 提出期限 YYYY-MM-DD */
  deadline: string
  completed: boolean
  /** 完了にした日（提出済み集計用）YYYY-MM-DD */
  completedAt: string | null
}

export function newEstimateTask(
  assigneeUserId: string,
  deadline: string,
  projectName: string,
  customerName: string,
  customerContact: string,
): EstimateTask {
  return {
    id: createId(),
    projectName: projectName.trim() || '（案件名なし）',
    customerName: customerName.trim() || '（顧客名なし）',
    customerContact: customerContact.trim(),
    assigneeUserId,
    deadline,
    completed: false,
    completedAt: null,
  }
}

export function normalizeStoredEstimateTask(x: unknown): EstimateTask | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  const deadline =
    typeof r.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.deadline)
      ? r.deadline
      : null
  if (!deadline) return null
  const completed = Boolean(r.completed)
  let completedAt: string | null = null
  if (
    typeof r.completedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.completedAt)
  ) {
    completedAt = r.completedAt
  } else if (completed) {
    completedAt = deadline
  }
  return {
    id: r.id,
    projectName:
      typeof r.projectName === 'string' ? r.projectName : '（案件名なし）',
    customerName:
      typeof r.customerName === 'string' ? r.customerName : '（顧客名なし）',
    customerContact:
      typeof r.customerContact === 'string' ? r.customerContact : '',
    assigneeUserId:
      typeof r.assigneeUserId === 'string' ? r.assigneeUserId : '',
    deadline,
    completed,
    completedAt: completed ? completedAt : null,
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

export type AttendanceOvertimeStatus = 'none' | 'pending' | 'approved' | 'rejected'

/** 事前の残業申請（予定時間・理由。承認は退勤とは別） */
export type AttendanceOvertimeRequest = {
  id: string
  appUserId: string
  workDate: string
  /** 予定残業時間（1時間単位・整数） */
  plannedHours: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  approvedAt: string | null
  approvedByLabel: string | null
}

/** 1日1行の勤怠（出勤・退勤＋GPS） */
export type AttendanceDayRecord = {
  id: string
  appUserId: string
  /** 勤務日（ローカル暦 YYYY-MM-DD） */
  workDate: string
  clockInAt: string
  clockOutAt: string | null
  clockInLat: number
  clockInLng: number
  clockOutLat: number | null
  clockOutLng: number | null
  overtimeStatus: AttendanceOvertimeStatus
  approvedAt: string | null
  /** 承認した管理者の表示名 */
  approvedByLabel: string | null
  /** @deprecated 事前申請（attendanceOvertimeRequests）を使用 */
  overtimeReason: string | null
  /** 紐づく事前残業申請 id */
  overtimeRequestId: string | null
  note: string | null
}

export type AppState = {
  version: 8
  users: User[]
  /** 活動ログの流入経路の選択肢（順序はフォーム・集計に反映） */
  leadSourceCatalog: SelectOptionItem[]
  /** 営業種類（id・表示名・分析ロール）。追加行は任意 id。 */
  activityTypeCatalog: ActivityTypeCatalogItem[]
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
  /** 見積書提出タスク */
  estimateTasks: EstimateTask[]
  /** 勤怠（会社共有。クラウド同期の対象） */
  attendanceRecords: AttendanceDayRecord[]
  /** 事前残業申請 */
  attendanceOvertimeRequests: AttendanceOvertimeRequest[]
  /** 残業承認などができる担当者（AppState.users の id） */
  attendanceAdminUserIds: string[]
  /** 打刻修正画面用パスワード（SHA-256 16進。空なら未設定） */
  attendanceCorrectionPasswordHash: string
  /** 残業承認・却下用パスワード（SHA-256 16進。空なら未設定） */
  attendanceApprovalPasswordHash: string
}

export function newUser(name: string): User {
  return { id: createId(), name: name.trim() || '無名' }
}

export function emptyMilestones(): UserMilestones {
  return { lastApproachDate: null, lastOrderDate: null }
}

export function emptyState(): AppState {
  const u = newUser('担当者1')
  return {
    version: 8,
    users: [u],
    leadSourceCatalog: defaultLeadSourceCatalog(),
    activityTypeCatalog: defaultActivityTypeCatalog(),
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
    estimateTasks: [],
    attendanceRecords: [],
    attendanceOvertimeRequests: [],
    attendanceAdminUserIds: [],
    attendanceCorrectionPasswordHash: '',
    attendanceApprovalPasswordHash: '',
  }
}
