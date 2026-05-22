import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  CHART_COLOR_KEYS,
  CHART_COLOR_LABELS,
  DEFAULT_CHART_COLORS,
  normalizeHex,
  type ChartColorPalette,
} from './chartColors'
import { EstimateTasksTab } from './EstimateTasksTab'
import { InvoicesTab } from './InvoicesTab'
import { SettingsTab } from './SettingsTab'
import { AttendanceTab } from './AttendanceTab'
import { TargetsTab } from './TargetsTab'
import { HomePage } from './HomePage'
import { PageBackBar } from './PageBackBar'
import { SalesSubNav } from './SalesSubNav'
import {
  isSalesPageTab,
  pageBackTitle,
  pageDocumentTitle,
  type PageTab,
} from './navigation/pageTabs'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  approachTargetsListEqual,
  syncApproachTargetsFromActivities,
} from './approachTargets'
import { createId } from './createId'
import { aggregateByMonth, filterActivities } from './aggregate'
import { colorForActivityTypeId } from './activityChartColors'
import {
  activitiesToCSV,
  downloadCSV,
  downloadText,
  parseActivityCSV,
} from './csv'
import {
  addCalendarMonthsYm,
  daysElapsedSince,
  formatDateJa,
  formatElapsedLabel,
  todayIsoDate,
} from './dates'
import {
  chartRows,
  formatYmJa,
  ordersPerQuoteRate,
  periodFunnel,
  quotesPerSalesActivityRate,
  sumTotals,
  totalApproaches,
  totalSalesActivities,
} from './metrics'
import {
  aggregateByLeadSource,
  filterActivitiesByPeriodScope,
  rowsWithLeadData,
} from './leadSourceAggregate'
import { fiscalTermNumberForStartYear, fiscalYearRangeLabel, fyStartYearFromCalendarYm } from './fiscalYear'
import {
  periodGroupChartTitleSuffix,
  rollupPeriodBuckets,
  type PeriodGroupMode,
} from './periodGroup'
import {
  buildUserCompareTabs,
  isLeadSourcesCompareTab,
  leadStackKeysFromCatalog,
  buildLeadSourceStackRows,
  buildUserPeriodTotals,
  leadStackLabel,
  tabValueForUser,
} from './userCompareMetrics'
import {
  CLOUD_AUTO_SAVE_DEBOUNCE_MS,
  persistAppStateToCloud,
  stateJsonFingerprint,
  type CloudSaveStatus,
} from './cloud/autoSave'
import { mergeActivityCsvIntoState, parseStateJson, stateToJson } from './stateJson'
import {
  clearStorage,
  initialState,
  sampleState,
  saveState,
} from './storage'
import { fetchSharedAppState } from './cloud/sharedAppState'
import { isSupabaseConfigured } from './supabaseClient'
import { useAuth } from './auth/AuthContext'
import { CloudLoginScreen } from './auth/CloudLoginScreen'
import { dataViewShowsOwnerColumn, dataViewSingleUserId, dataViewSummaryLabel } from './dataViewSelection'
import { DataViewUserSelectBar } from './DataViewUserSelectBar'
import { usersForSalesAnalytics } from './userRoles'
import type {
  ActivityLog,
  ActivityType,
  AppState,
  DataViewUserIds,
} from './types'
import {
  emptyMilestones,
  emptyState,
  labelForActivityTypeId,
  labelForLeadSourceId,
  newUser,
} from './types'
import { useMediaQuery } from './useMediaQuery'
import './App.css'

const MIN_FOCUS_MONTH_YM = '2000-01'

/** 月次モードの折れ線・件数比較バーごとに「表示終端月」を持つグラフ */
const DASHBOARD_TREND_CHART_IDS = [
  'activityTypes',
  'quotesOrders',
  'rates',
  'funnel',
  'countsBar',
] as const

type DashboardTrendChartId = (typeof DASHBOARD_TREND_CHART_IDS)[number]

function initialTrendChartEndYms(ym: string): Record<DashboardTrendChartId, string> {
  return {
    activityTypes: ym,
    quotesOrders: ym,
    rates: ym,
    funnel: ym,
    countsBar: ym,
  }
}

function clampDashboardYm(value: string, maxYm: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return maxYm
  if (value < MIN_FOCUS_MONTH_YM) return MIN_FOCUS_MONTH_YM
  if (value > maxYm) return maxYm
  return value
}

function formatCloudSavedAt(ts: number): string {
  return new Date(ts).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function usePersistentAppState(): {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  toast: string | null
  showToast: (msg: string) => void
  dataReady: boolean
  cloudSave: CloudSaveStatus
  forceCloudSave: () => Promise<void>
} {
  const auth = useAuth()
  const [state, setState] = useState<AppState>(() =>
    !isSupabaseConfigured ? initialState() : emptyState(),
  )
  const [dataReady, setDataReady] = useState(!isSupabaseConfigured)
  const [cloudSave, setCloudSave] = useState<CloudSaveStatus>({
    phase: 'idle',
    lastOkAt: null,
  })
  const stateRef = useRef(state)
  const lastCloudJsonRef = useRef<string | null>(null)
  const hydrationDoneRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const lastErrorToastAtRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!auth.ready) return
    if (!auth.configured) {
      setState(initialState())
      setDataReady(true)
      return
    }
    if (!auth.user?.id) {
      setDataReady(false)
      hydrationDoneRef.current = false
      lastCloudJsonRef.current = null
      return
    }

    let cancelled = false
    setDataReady(false)
    hydrationDoneRef.current = false
    lastCloudJsonRef.current = null
    void (async () => {
      try {
        const remote = await fetchSharedAppState()
        if (cancelled) return
        const next = remote ?? emptyState()
        setState(next)
        lastCloudJsonRef.current = stateJsonFingerprint(next)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          const next = emptyState()
          setState(next)
          lastCloudJsonRef.current = stateJsonFingerprint(next)
        }
      } finally {
        if (!cancelled) {
          hydrationDoneRef.current = true
          setDataReady(true)
          setCloudSave({ phase: 'ok', lastOkAt: Date.now() })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [auth.ready, auth.configured, auth.user?.id])

  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const runCloudSave = useCallback(
    async (snap: AppState, opts?: { fromAuto?: boolean }) => {
      if (!auth.configured || !auth.user?.id) return
      if (savingRef.current) return
      const json = stateJsonFingerprint(snap)
      if (lastCloudJsonRef.current === json) {
        setCloudSave((s) =>
          s.phase === 'pending' ? { ...s, phase: 'ok' } : s,
        )
        return
      }
      savingRef.current = true
      setCloudSave((s) => ({ ...s, phase: 'syncing' }))
      try {
        await persistAppStateToCloud(snap)
        lastCloudJsonRef.current = json
        setCloudSave({ phase: 'ok', lastOkAt: Date.now() })
      } catch (e) {
        console.error(e)
        setCloudSave((s) => ({ phase: 'error', lastOkAt: s.lastOkAt }))
        if (opts?.fromAuto) {
          const now = Date.now()
          if (now - lastErrorToastAtRef.current > 12_000) {
            lastErrorToastAtRef.current = now
            showToast('自動保存に失敗しました。ネットワークを確認し「今すぐ保存」を押してください')
          }
        } else {
          showToast('クラウド保存に失敗しました')
        }
        throw e
      } finally {
        savingRef.current = false
      }
    },
    [auth.configured, auth.user?.id, showToast],
  )

  const flushCloudSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void runCloudSave(stateRef.current, { fromAuto: true })
  }, [runCloudSave])

  useEffect(() => {
    if (!dataReady) return
    if (!auth.configured) {
      saveState(state)
      return
    }
    if (!auth.user?.id || !hydrationDoneRef.current) return

    saveState(state)
    const json = stateJsonFingerprint(state)
    if (lastCloudJsonRef.current === json) return

    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current)
    }
    setCloudSave((s) =>
      s.phase === 'syncing' ? s : { ...s, phase: 'pending' },
    )
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void runCloudSave(stateRef.current, { fromAuto: true })
    }, CLOUD_AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current != null) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [state, dataReady, auth.configured, auth.user?.id, runCloudSave])

  useEffect(() => {
    if (!auth.configured || !auth.user?.id) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushCloudSave()
    }
    const onPageHide = () => flushCloudSave()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [auth.configured, auth.user?.id, flushCloudSave])

  const forceCloudSave = useCallback(async () => {
    if (!auth.configured || !auth.user?.id) return
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    try {
      await runCloudSave(stateRef.current)
      showToast('クラウドへ保存しました')
    } catch {
      /* runCloudSave がトースト表示済み */
    }
  }, [auth.configured, auth.user?.id, runCloudSave, showToast])

  return { state, setState, toast, showToast, dataReady, cloudSave, forceCloudSave }
}

function milestonesOf(state: AppState, userId: string | null) {
  if (!userId) return emptyMilestones()
  return state.milestonesByUser[userId] ?? emptyMilestones()
}

function DashboardApp({
  state,
  setState,
  toast,
  showToast,
  cloudSave,
  forceCloudSave,
}: {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  toast: string | null
  showToast: (msg: string) => void
  cloudSave: CloudSaveStatus
  forceCloudSave: () => Promise<void>
}) {
  const auth = useAuth()
  const {
    users,
    sessionUserId,
    dataViewUserIds,
    activities,
    approachTargets,
    chartColors,
    invoices,
    invoiceAnnualRevenueTargets,
    companySettings,
    estimateTasks,
    leadSourceCatalog,
    activityTypeCatalog,
    attendanceRecords,
    attendanceAdminUserIds,
    attendanceCorrectionPasswordHash,
  } = state

  const salesUsers = useMemo(() => usersForSalesAnalytics(users), [users])

  const fiscalSm = companySettings.fiscalYearStartMonth

  const milestoneUserId = dataViewSingleUserId(dataViewUserIds)
  const showMilestones = milestoneUserId !== null

  const [pageTab, setPageTab] = useState<PageTab>('home')
  const narrowLayout = useMediaQuery('(max-width: 960px)')

  useEffect(() => {
    document.title = pageDocumentTitle(pageTab)
  }, [pageTab])

  useEffect(() => {
    setState((prev) => {
      const synced = syncApproachTargetsFromActivities(
        prev.approachTargets,
        prev.activities,
      )
      if (approachTargetsListEqual(prev.approachTargets, synced)) {
        return prev
      }
      return { ...prev, approachTargets: synced }
    })
    /** approachTargets は手動編集でも同期するが、活動ログが変わったときの再計算が主目的（依存を activities のみにして二重更新を避ける） */
  }, [activities])
  const csvRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  const [newUserName, setNewUserName] = useState('')

  const [formDate, setFormDate] = useState(() => todayIsoDate())
  const [formCustomer, setFormCustomer] = useState('')
  const [formLeadSource, setFormLeadSource] = useState<string | null>(null)
  const [formType, setFormType] = useState<ActivityType>('teleAppo')
  const [formQuote, setFormQuote] = useState(0)
  const [formOrder, setFormOrder] = useState(0)
  const leadSourceIdSet = useMemo(
    () => new Set(leadSourceCatalog.map((x) => x.id)),
    [leadSourceCatalog],
  )

  useEffect(() => {
    setFormLeadSource((cur) =>
      cur != null && cur !== '' && !leadSourceIdSet.has(cur) ? null : cur,
    )
  }, [leadSourceIdSet])

  const [syncApproach, setSyncApproach] = useState(true)
  const [syncOrderDate, setSyncOrderDate] = useState(true)
  const [periodGroup, setPeriodGroup] = useState<PeriodGroupMode>('month')
  const activityTypeIds = useMemo(
    () => activityTypeCatalog.map((c) => c.id),
    [activityTypeCatalog],
  )

  const activityTypeIdSet = useMemo(
    () => new Set(activityTypeIds),
    [activityTypeIds],
  )

  useEffect(() => {
    setFormType((cur) => {
      if (activityTypeIdSet.has(cur)) return cur
      return (
        activityTypeCatalog.find((x) => x.id === 'teleAppo')?.id ??
        activityTypeCatalog[0]?.id ??
        'teleAppo'
      )
    })
  }, [activityTypeIdSet, activityTypeCatalog])

  const userCompareTabs = useMemo(
    () => buildUserCompareTabs(activityTypeCatalog),
    [activityTypeCatalog],
  )

  const [userCompareTab, setUserCompareTab] = useState<string>('salesActs')

  useEffect(() => {
    if (!userCompareTabs.some((t) => t.id === userCompareTab)) {
      setUserCompareTab('salesActs')
    }
  }, [userCompareTabs, userCompareTab])
  /** 月次モード時、カードが参照する暦月（YYYY-MM） */
  const [focusMonthYm, setFocusMonthYm] = useState(() =>
    todayIsoDate().slice(0, 7),
  )
  const [trendChartEndYmById, setTrendChartEndYmById] = useState<
    Record<DashboardTrendChartId, string>
  >(() => initialTrendChartEndYms(todayIsoDate().slice(0, 7)))
  const [dashboardFiscalFocusStartYear, setDashboardFiscalFocusStartYear] =
    useState(() =>
      fyStartYearFromCalendarYm(
        todayIsoDate().slice(0, 7),
        companySettings.fiscalYearStartMonth,
      ),
    )
  const [calendarTick, setCalendarTick] = useState(0)
  const dashboardCalendarYmRef = useRef<string | null>(null)
  const dashboardFiscalRef = useRef<number | null>(null)

  useEffect(() => {
    setDashboardFiscalFocusStartYear(
      fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), fiscalSm),
    )
  }, [fiscalSm])

  useEffect(() => {
    dashboardCalendarYmRef.current = null
    dashboardFiscalRef.current = null

    const run = () => {
      setCalendarTick((t) => t + 1)
      const ym = todayIsoDate().slice(0, 7)
      const fy = fyStartYearFromCalendarYm(ym, fiscalSm)

      if (dashboardCalendarYmRef.current === null) {
        dashboardCalendarYmRef.current = ym
        dashboardFiscalRef.current = fy
        return
      }

      const prevYm = dashboardCalendarYmRef.current
      const prevFy = dashboardFiscalRef.current ?? fy

      if (ym !== prevYm) {
        dashboardCalendarYmRef.current = ym
        setFocusMonthYm((cur) => (cur === prevYm ? ym : cur))
        setTrendChartEndYmById((prev) => {
          const next = { ...prev }
          for (const id of DASHBOARD_TREND_CHART_IDS) {
            if (next[id] === prevYm) next[id] = ym
          }
          return next
        })
      }

      if (fy !== prevFy) {
        dashboardFiscalRef.current = fy
        setDashboardFiscalFocusStartYear((cur) => (cur === prevFy ? fy : cur))
      } else {
        dashboardFiscalRef.current = fy
      }
    }
    run()
    const id = window.setInterval(run, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fiscalSm])

  const visibleActivities = useMemo(
    () => filterActivities(activities, dataViewUserIds),
    [activities, dataViewUserIds],
  )

  const months = useMemo(
    () => aggregateByMonth(visibleActivities, activityTypeIds),
    [visibleActivities, activityTypeIds],
  )

  const bucketedMonths = useMemo(
    () => rollupPeriodBuckets(months, periodGroup, fiscalSm, activityTypeIds),
    [months, periodGroup, fiscalSm, activityTypeIds],
  )

  /** 表示単位に合わせたカード用の集計（月次＝選んだ暦月、年次＝選択した会計年度、合計＝全期間） */
  const { totals, cardScopeLabel } = useMemo(() => {
    const todayYm = todayIsoDate().slice(0, 7)
    const currentFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)
    if (periodGroup === 'all') {
      return {
        totals: sumTotals(months),
        cardScopeLabel: '集計: 表示範囲の全期間',
      }
    }
    if (periodGroup === 'fiscalYearMarch') {
      const slice = months.filter(
        (m) =>
          fyStartYearFromCalendarYm(m.ym, fiscalSm) ===
          dashboardFiscalFocusStartYear,
      )
      const isCurrent = dashboardFiscalFocusStartYear === currentFy
      const term = fiscalTermNumberForStartYear(
        dashboardFiscalFocusStartYear,
        companySettings.anchorFiscalYearStartYear,
        companySettings.anchorFiscalTermNumber,
      )
      return {
        totals: sumTotals(slice),
        cardScopeLabel: `集計: ${fiscalYearRangeLabel(dashboardFiscalFocusStartYear, fiscalSm)}（第${term}期）${isCurrent ? '（今期）' : ''}`,
      }
    }
    const slice = months.filter((m) => m.ym === focusMonthYm)
    const isThisMonth = focusMonthYm === todayYm
    return {
      totals: sumTotals(slice),
      cardScopeLabel: `集計: ${formatYmJa(focusMonthYm)}${isThisMonth ? '（今月）' : ''}`,
    }
  }, [
    periodGroup,
    months,
    focusMonthYm,
    calendarTick,
    fiscalSm,
    dashboardFiscalFocusStartYear,
    companySettings.anchorFiscalYearStartYear,
    companySettings.anchorFiscalTermNumber,
  ])

  const scopedActivitiesForLeadSource = useMemo(
    () =>
      filterActivitiesByPeriodScope(
        visibleActivities,
        periodGroup,
        focusMonthYm,
        todayIsoDate(),
        fiscalSm,
        dashboardFiscalFocusStartYear,
      ),
    [
      visibleActivities,
      periodGroup,
      focusMonthYm,
      calendarTick,
      fiscalSm,
      dashboardFiscalFocusStartYear,
    ],
  )

  const leadSourceAggAll = useMemo(
    () =>
      aggregateByLeadSource(scopedActivitiesForLeadSource, leadSourceCatalog),
    [scopedActivitiesForLeadSource, leadSourceCatalog],
  )

  const leadByActivityDesc = useMemo(
    () =>
      rowsWithLeadData(leadSourceAggAll).sort(
        (a, b) =>
          b.activityCount - a.activityCount || b.quoteSum - a.quoteSum,
      ),
    [leadSourceAggAll],
  )

  const leadByQuoteDesc = useMemo(
    () =>
      rowsWithLeadData(leadSourceAggAll).sort(
        (a, b) =>
          b.quoteSum - a.quoteSum ||
          b.activitiesWithQuote - a.activitiesWithQuote,
      ),
    [leadSourceAggAll],
  )

  const leadByQuotePositive = useMemo(
    () => leadByQuoteDesc.filter((r) => r.quoteSum > 0),
    [leadByQuoteDesc],
  )

  const hasLeadSourceChartData = leadByActivityDesc.length > 0

  const userPeriodTotals = useMemo(
    () =>
      buildUserPeriodTotals(
        salesUsers,
        activities,
        activityTypeIds,
        periodGroup,
        focusMonthYm,
        todayIsoDate(),
        fiscalSm,
        dashboardFiscalFocusStartYear,
      ),
    [
      salesUsers,
      activities,
      activityTypeIds,
      periodGroup,
      focusMonthYm,
      calendarTick,
      fiscalSm,
      dashboardFiscalFocusStartYear,
    ],
  )

  const userCompareBarRows = useMemo(() => {
    if (isLeadSourcesCompareTab(userCompareTab)) return []
    return userPeriodTotals.map((row) => ({
      name: row.displayName,
      value: tabValueForUser(row, userCompareTab, activityTypeCatalog),
    }))
  }, [
    userPeriodTotals,
    userCompareTab,
    activityTypeCatalog,
  ])

  const userCompareLeadStack = useMemo(
    () =>
      buildLeadSourceStackRows(
        salesUsers,
        activities,
        leadSourceCatalog,
        periodGroup,
        focusMonthYm,
        todayIsoDate(),
        fiscalSm,
        dashboardFiscalFocusStartYear,
      ),
    [
      salesUsers,
      activities,
      leadSourceCatalog,
      periodGroup,
      focusMonthYm,
      calendarTick,
      fiscalSm,
      dashboardFiscalFocusStartYear,
    ],
  )

  const userCompareTabKind = userCompareTabs.find(
    (t) => t.id === userCompareTab,
  )?.kind

  const maxFocusMonthYm = todayIsoDate().slice(0, 7)

  const bumpFocusMonth = useCallback(
    (delta: number) => {
      setFocusMonthYm((cur) => {
        const next = addCalendarMonthsYm(cur, delta)
        if (next < MIN_FOCUS_MONTH_YM) return MIN_FOCUS_MONTH_YM
        if (next > maxFocusMonthYm) return maxFocusMonthYm
        return next
      })
    },
    [maxFocusMonthYm],
  )

  const onFocusMonthInput = useCallback(
    (value: string) => {
      if (!/^\d{4}-\d{2}$/.test(value)) return
      if (value < MIN_FOCUS_MONTH_YM) {
        setFocusMonthYm(MIN_FOCUS_MONTH_YM)
        return
      }
      if (value > maxFocusMonthYm) {
        setFocusMonthYm(maxFocusMonthYm)
        return
      }
      setFocusMonthYm(value)
    },
    [maxFocusMonthYm],
  )
  const approaches = useMemo(
    () => totalApproaches(totals, activityTypeCatalog),
    [totals, activityTypeCatalog],
  )
  const salesActs = useMemo(
    () => totalSalesActivities(totals, activityTypeCatalog),
    [totals, activityTypeCatalog],
  )
  const funnel = useMemo(
    () => periodFunnel(totals, activityTypeCatalog),
    [totals, activityTypeCatalog],
  )
  const rateQuotePerSales = useMemo(
    () => quotesPerSalesActivityRate(totals, activityTypeCatalog),
    [totals, activityTypeCatalog],
  )
  const rateOrderPerQuote = useMemo(() => ordersPerQuoteRate(totals), [totals])

  const hasBucketedChartSource = bucketedMonths.length > 0

  const dashboardChartSlices = useMemo(() => {
    type ChartRow = ReturnType<typeof chartRows>[number]
    type BarRow = Record<string, string | number>
    type Slice = {
      chartData: ChartRow[]
      barComparisonRows: BarRow[]
      hasData: boolean
      lineXAxisProps: {
        dataKey: 'label'
        tick: { fontSize: number }
        angle: number
        textAnchor: 'end' | 'middle'
        height: number
        interval: 0
      }
      barXAxisProps: {
        dataKey: 'name'
        tick: { fontSize: number }
        angle: number
        textAnchor: 'end' | 'middle'
        height: number
        interval: 0
      }
    }
    const capYm = maxFocusMonthYm
    const result = {} as Record<DashboardTrendChartId, Slice>

    const sliceBucketedFor = (endYm: string) => {
      if (periodGroup !== 'month') return bucketedMonths
      const y = clampDashboardYm(endYm, capYm)
      return bucketedMonths.filter((m) => m.ym <= y)
    }

    for (const id of DASHBOARD_TREND_CHART_IDS) {
      const sliced = sliceBucketedFor(trendChartEndYmById[id])
      const chartData = chartRows(sliced, activityTypeCatalog)
      const slanted = periodGroup !== 'month' || chartData.length > 10
      const angle = slanted ? -22 : 0
      const textAnchor = slanted ? ('end' as const) : ('middle' as const)
      result[id] = {
        chartData,
        barComparisonRows: chartData.map((row) => {
          const bar: BarRow = {
            name: row.label,
            quotes: row.quotes,
            closedWon: row.closedWon,
          }
          const r = row as Record<string, number | string>
          for (const { id: atId } of activityTypeCatalog) {
            const v = r[atId]
            bar[atId] = typeof v === 'number' ? v : 0
          }
          return bar
        }),
        hasData: sliced.length > 0,
        lineXAxisProps: {
          dataKey: 'label',
          tick: { fontSize: 11 },
          angle,
          textAnchor,
          height: slanted ? 68 : 28,
          interval: 0,
        },
        barXAxisProps: {
          dataKey: 'name',
          tick: { fontSize: 10 },
          angle,
          textAnchor,
          height: slanted ? 72 : 32,
          interval: 0,
        },
      }
    }
    return result
  }, [
    bucketedMonths,
    periodGroup,
    trendChartEndYmById,
    maxFocusMonthYm,
    activityTypeCatalog,
  ])

  const trendChartMonthToolbar = useCallback(
    (id: DashboardTrendChartId) => {
      if (periodGroup !== 'month') return null
      return (
        <div className="chart-panel-month-toolbar">
          <label className="field inline chart-end-ym-field">
            <span className="field-label">表示終端月</span>
            <input
              type="month"
              className="cell-input input-month"
              min={MIN_FOCUS_MONTH_YM}
              max={maxFocusMonthYm}
              value={trendChartEndYmById[id]}
              onChange={(e) => {
                const raw = e.target.value || maxFocusMonthYm
                setTrendChartEndYmById((prev) => ({
                  ...prev,
                  [id]: clampDashboardYm(raw, maxFocusMonthYm),
                }))
              }}
              aria-label="このグラフの表示終端月"
            />
          </label>
          <button
            type="button"
            className="btn small ghost chart-sync-card-month"
            onClick={() =>
              setTrendChartEndYmById((p) => ({ ...p, [id]: focusMonthYm }))
            }
          >
            カードの月に合わせる
          </button>
        </div>
      )
    },
    [periodGroup, maxFocusMonthYm, trendChartEndYmById, focusMonthYm],
  )

  const activityFiscalYearsForSelect = useMemo(() => {
    const s = new Set<number>()
    for (const m of months) {
      s.add(fyStartYearFromCalendarYm(m.ym, fiscalSm))
    }
    const todayYm = todayIsoDate().slice(0, 7)
    const currentFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)
    s.add(currentFy)
    s.add(dashboardFiscalFocusStartYear)
    return [...s].sort((a, b) => b - a)
  }, [months, fiscalSm, dashboardFiscalFocusStartYear, calendarTick])

  const dashboardCurrentFy = useMemo(
    () => fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), fiscalSm),
    [fiscalSm, calendarTick],
  )

  const periodChartTitle = periodGroupChartTitleSuffix(periodGroup, fiscalSm)

  const msForPanel = milestonesOf(state, milestoneUserId)
  const lastApproachDate = msForPanel.lastApproachDate
  const lastOrderDate = msForPanel.lastOrderDate

  const daysApproach = useMemo(
    () => daysElapsedSince(lastApproachDate),
    [lastApproachDate],
  )
  const daysOrder = useMemo(
    () => daysElapsedSince(lastOrderDate),
    [lastOrderDate],
  )

  const sessionUser = useMemo(
    () => salesUsers.find((u) => u.id === sessionUserId) ?? null,
    [salesUsers, sessionUserId],
  )

  const sortedActivities = useMemo(() => {
    return [...visibleActivities].sort((a, b) => {
      const d = b.date.localeCompare(a.date)
      return d !== 0 ? d : a.customerName.localeCompare(b.customerName)
    })
  }, [visibleActivities])

  const patchMilestones = (
    userId: string,
    patch: Partial<{ lastApproachDate: string | null; lastOrderDate: string | null }>,
  ) => {
    setState((prev) => {
      const cur = prev.milestonesByUser[userId] ?? emptyMilestones()
      return {
        ...prev,
        milestonesByUser: {
          ...prev.milestonesByUser,
          [userId]: { ...cur, ...patch },
        },
      }
    })
  }

  const submitActivity = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionUserId) {
      showToast('先にユーザーを選択してください')
      return
    }
    const name = formCustomer.trim()
    if (!name) {
      showToast('顧客名を入力してください')
      return
    }
    const quoteCount = Math.max(0, Math.round(formQuote))
    const orderCount = Math.max(0, Math.round(formOrder))
    const row: ActivityLog = {
      id: createId(),
      userId: sessionUserId,
      date: formDate,
      customerName: name,
      leadSource: formLeadSource,
      activityType: formType,
      quoteCount,
      orderCount,
    }

    setState((prev) => {
      let milestonesByUser = { ...prev.milestonesByUser }
      const m = milestonesByUser[sessionUserId] ?? emptyMilestones()
      let lastApproachDate = m.lastApproachDate
      let lastOrderDate = m.lastOrderDate
      if (syncApproach) lastApproachDate = formDate
      if (syncOrderDate && orderCount > 0) lastOrderDate = formDate
      milestonesByUser = {
        ...milestonesByUser,
        [sessionUserId]: { lastApproachDate, lastOrderDate },
      }
      const nextActivities = [row, ...prev.activities]
      return {
        ...prev,
        activities: nextActivities,
        milestonesByUser,
        approachTargets: syncApproachTargetsFromActivities(
          prev.approachTargets,
          nextActivities,
        ),
      }
    })

    setFormCustomer('')
    setFormLeadSource(null)
    setFormQuote(0)
    setFormOrder(0)
    setFormDate(todayIsoDate())
    showToast('活動を記録しました')
  }

  const removeActivity = (id: string) => {
    setState((prev) => {
      const nextActivities = prev.activities.filter((a) => a.id !== id)
      return {
        ...prev,
        activities: nextActivities,
        approachTargets: syncApproachTargetsFromActivities(
          prev.approachTargets,
          nextActivities,
        ),
      }
    })
  }

  const setApproachToday = () => {
    if (!milestoneUserId) return
    patchMilestones(milestoneUserId, { lastApproachDate: todayIsoDate() })
    showToast('前回アプローチ日を今日に更新しました')
  }

  const setOrderToday = () => {
    if (!milestoneUserId) return
    patchMilestones(milestoneUserId, { lastOrderDate: todayIsoDate() })
    showToast('前回受注日を今日に更新しました')
  }

  const addUserHandler = () => {
    const name = newUserName.trim()
    if (!name) {
      showToast('ユーザー名を入力してください')
      return
    }
    const u = newUser(name)
    setState((prev) => ({
      ...prev,
      users: [...prev.users, u],
      milestonesByUser: {
        ...prev.milestonesByUser,
        [u.id]: emptyMilestones(),
      },
      sessionUserId: u.id,
    }))
    setNewUserName('')
    showToast(`ユーザーを追加しました：${u.name}`)
  }

  const removeUser = (id: string) => {
    if (users.length <= 1) {
      showToast('最後の1人は削除できません')
      return
    }
    if (activities.some((a) => a.userId === id)) {
      showToast('活動ログが残っているユーザーは削除できません')
      return
    }
    setState((prev) => {
      const nextUsers = prev.users.filter((u) => u.id !== id)
      const { [id]: _, ...restMs } = prev.milestonesByUser
      let nextSession = prev.sessionUserId
      if (nextSession === id) nextSession = nextUsers[0]?.id ?? null
      let nextDataView: DataViewUserIds = prev.dataViewUserIds
      if (nextDataView !== 'all') {
        const idSet = new Set(nextUsers.map((u) => u.id))
        nextDataView = nextDataView.filter((uid) => idSet.has(uid) && uid !== id)
        if (nextDataView.length === 0) nextDataView = 'all'
      }
      return {
        ...prev,
        users: nextUsers,
        sessionUserId: nextSession,
        dataViewUserIds: nextDataView,
        milestonesByUser: restMs,
      }
    })
    showToast('ユーザーを削除しました')
  }

  const onExportCsv = () => {
    const csv = activitiesToCSV(activities)
    downloadCSV(`営業活動ログ_${new Date().toISOString().slice(0, 10)}.csv`, csv)
    showToast('活動ログCSV（全ユーザー）をダウンロードしました')
  }

  const onExportJson = () => {
    downloadText(
      `営業データ分析_全状態_${new Date().toISOString().slice(0, 10)}.json`,
      stateToJson(state),
      'application/json;charset=utf-8',
    )
    showToast('JSON（全状態）をダウンロードしました')
  }

  const defaultCsvUserId = sessionUserId ?? salesUsers[0]?.id ?? ''

  const onImportCsv: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const next = parseActivityCSV(
          text,
          defaultCsvUserId,
          leadSourceIdSet,
          activityTypeIdSet,
        )
        if (next.length === 0) throw new Error('有効な行がありません')
        setState((prev) => mergeActivityCsvIntoState(prev, next))
        showToast(`活動${next.length}件を取り込みました`)
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'CSVの読み込みに失敗しました',
        )
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const onImportJson: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const next = parseStateJson(text)
        setState(next)
        showToast('JSONを取り込みました')
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'JSONの読み込みに失敗しました',
        )
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const onResetSample = () => {
    setState(sampleState())
    showToast('サンプルデータを読み込みました')
  }

  const onClearAll = () => {
    clearStorage()
    setState(emptyState())
    showToast('データをリセットしました')
  }

  const patchChartColor = useCallback((key: keyof ChartColorPalette, raw: string) => {
    setState((prev) => ({
      ...prev,
      chartColors: {
        ...prev.chartColors,
        [key]: normalizeHex(raw, prev.chartColors[key]),
      },
    }))
  }, [])

  const resetChartColors = useCallback(() => {
    setState((prev) => ({ ...prev, chartColors: { ...DEFAULT_CHART_COLORS } }))
    showToast('グラフの色を初期値に戻しました')
  }, [showToast])

  const c = chartColors

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">
            {companySettings.companyName.trim() ? (
              <>
                <span className="header-company-name">
                  {companySettings.companyName.trim()}
                </span>
                <span className="header-title-sep"> — </span>
              </>
            ) : null}
            営業データ分析
          </h1>
          <p className="subtitle">
            {pageTab === 'home' ? (
              <>メニューから各機能を開けます。データの書き出し・取込は上部のボタンから行えます。</>
            ) : (
              <>
                <strong>データ表示</strong>のプルダウンで、チェックを付けた担当の活動・集計だけを表示します（
                <strong>複数人</strong>や<strong>自分以外だけ</strong>も可能）。<strong>全員</strong>
                ですべてをまとめて見られます。活動の追加は常に「記録する担当」に紐づきます。
              </>
            )}
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={onExportCsv}>
            活動CSV
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => csvRef.current?.click()}
          >
            活動CSV取込
          </button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={onImportCsv}
          />
          <button type="button" className="btn" onClick={onExportJson}>
            全状態JSON
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => jsonRef.current?.click()}
          >
            JSON取込
          </button>
          <input
            ref={jsonRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={onImportJson}
          />
          {auth.configured ? (
            <>
              <span
                className={`header-cloud-sync${
                  cloudSave.phase === 'error' ? ' header-cloud-sync-error' : ''
                }`}
                title="編集後は約0.9秒で自動保存。タブを閉じる直前にも保存します。"
              >
                {cloudSave.phase === 'pending'
                  ? '自動保存待ち…'
                  : cloudSave.phase === 'syncing'
                    ? '自動保存中…'
                    : cloudSave.phase === 'error'
                      ? `自動保存に失敗${
                          cloudSave.lastOkAt != null
                            ? `（最終成功 ${formatCloudSavedAt(cloudSave.lastOkAt)}）`
                            : ''
                        }`
                      : cloudSave.lastOkAt != null
                        ? `自動保存済 ${formatCloudSavedAt(cloudSave.lastOkAt)}`
                        : '自動保存します（編集すると反映）'}
              </span>
              <button
                type="button"
                className="btn"
                disabled={cloudSave.phase === 'syncing'}
                onClick={() => {
                  void forceCloudSave()
                }}
              >
                今すぐ保存
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  void auth.signOut()
                }}
              >
                ログアウト
              </button>
            </>
          ) : null}
        </div>
      </header>

      {toast && <div className="toast" role="status">{toast}</div>}

      {pageTab === 'home' ? (
        <HomePage
          companyName={companySettings.companyName}
          onNavigate={setPageTab}
        />
      ) : (
        <>
          <PageBackBar
            title={pageBackTitle(pageTab)}
            onBack={() => setPageTab('home')}
          />
          {isSalesPageTab(pageTab) ? (
            <SalesSubNav active={pageTab} onSelect={setPageTab} />
          ) : null}

      {pageTab === 'dashboard' ? (
        <>
      <div className="panel user-bar" aria-label="ユーザーと表示範囲">
        <div className="user-bar-row">
          <label className="field inline">
            <span className="field-label">記録する担当</span>
            <select
              className="cell-input"
              value={sessionUserId ?? ''}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  sessionUserId: e.target.value || null,
                }))
              }
            >
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="user-bar-row">
          <DataViewUserSelectBar
            users={salesUsers}
            dataViewUserIds={dataViewUserIds}
            setState={setState}
            showHint={false}
          />
        </div>
        <div className="user-bar-row add-user-row">
          <input
            type="text"
            className="cell-input grow"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="新しいユーザー名"
          />
          <button type="button" className="btn primary" onClick={addUserHandler}>
            ユーザーを追加
          </button>
          {sessionUserId && salesUsers.length > 1 && (
            <button
              type="button"
              className="btn danger ghost"
              onClick={() => removeUser(sessionUserId)}
              title="活動0件のときのみ削除できます"
            >
              このユーザーを削除
            </button>
          )}
        </div>
      </div>

      <div className="layout-main">
        {(() => {
          const activitySidebarPanels = (
            <>
              <div className="panel side-form">
            <h2 className="side-title">活動を記録</h2>
            <p className="hint small">
              登録先：<strong>{sessionUser?.name ?? '未選択'}</strong>
            </p>
            <form className="activity-form" onSubmit={submitActivity}>
              <label className="field">
                <span className="field-label">活動日</span>
                <input
                  type="date"
                  className="cell-input date-wide"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">顧客名</span>
                <input
                  type="text"
                  className="cell-input"
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  placeholder="例：株式会社〇〇"
                  autoComplete="organization"
                />
              </label>
              <label className="field">
                <span className="field-label">流入経路</span>
                <select
                  className="cell-input"
                  value={formLeadSource ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setFormLeadSource(v === '' ? null : v)
                  }}
                >
                  <option value="">未選択</option>
                  {leadSourceCatalog.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">営業種類</span>
                <select
                  className="cell-input"
                  value={formType}
                  onChange={(e) =>
                    setFormType(e.target.value as ActivityType)
                  }
                >
                  {activityTypeCatalog.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">見積もり件数（結果）</span>
                <input
                  type="number"
                  min={0}
                  className="cell-input num"
                  value={formQuote}
                  onChange={(e) =>
                    setFormQuote(Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">受注件数（結果）</span>
                <input
                  type="number"
                  min={0}
                  className="cell-input num"
                  value={formOrder}
                  onChange={(e) =>
                    setFormOrder(Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={syncApproach}
                  onChange={(e) => setSyncApproach(e.target.checked)}
                />
                前回アプローチ日をこの活動日に合わせる（自分用）
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={syncOrderDate}
                  onChange={(e) => setSyncOrderDate(e.target.checked)}
                />
                受注が1件以上なら、前回受注日もこの活動日に合わせる（自分用）
              </label>
              <button
                type="submit"
                className="btn primary wide"
                disabled={!sessionUserId}
              >
                追加する
              </button>
            </form>
          </div>

          <div className="panel activity-log">
            <h2 className="side-title">
              活動一覧（{dataViewSummaryLabel(dataViewUserIds, salesUsers)}）
            </h2>
            <p className="hint small">
              {visibleActivities.length === 0
                ? '該当する活動がありません。'
                : `${visibleActivities.length} 件`}
            </p>
            <ul className="activity-list">
              {sortedActivities.slice(0, 80).map((a) => {
                const owner = users.find((u) => u.id === a.userId)
                return (
                  <li key={a.id} className="activity-item">
                    <div className="activity-meta">
                      <span className="activity-date">{a.date}</span>
                      <span className="activity-type-pill">
                        {labelForActivityTypeId(activityTypeCatalog, a.activityType)}
                      </span>
                      {a.leadSource && (
                        <span className="activity-lead-pill" title="流入経路">
                          {labelForLeadSourceId(leadSourceCatalog, a.leadSource)}
                        </span>
                      )}
                      {dataViewShowsOwnerColumn(dataViewUserIds) && (
                        <span className="activity-owner">{owner?.name ?? '?'}</span>
                      )}
                    </div>
                    <div className="activity-body">
                      <strong className="activity-customer">{a.customerName}</strong>
                      <span className="activity-result">
                        見積 {a.quoteCount}／受注 {a.orderCount}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn icon danger del-activity"
                      onClick={() => removeActivity(a.id)}
                      title="この活動を削除"
                    >
                      削除
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
            </>
          )
          return (
            <aside className="sidebar" aria-label="営業活動の入力">
              {narrowLayout ? (
                <details className="mobile-input-drawer" open>
                  <summary className="mobile-input-drawer-summary">
                    活動の記録・一覧（タップで開閉）
                  </summary>
                  <div className="mobile-input-drawer-body">
                    {activitySidebarPanels}
                  </div>
                </details>
              ) : (
                activitySidebarPanels
              )}
            </aside>
          )
        })()}

        <div className="main-column">
          {showMilestones ? (
            <section className="panel milestone-panel" aria-label="前回日付と経過日数">
              <h2>
                前回のアプローチ・受注からの経過（
                {users.find((u) => u.id === milestoneUserId)?.name ?? ''}）
              </h2>
              <p className="hint">
                左のチェックで更新するのも、ここで直接変えるのも、どちらもこのユーザーのマイルストーンです。
              </p>
              <div className="milestone-grid">
                <div className="milestone-card">
                  <h3>前回アプローチ日</h3>
                  <input
                    type="date"
                    className="cell-input date-wide"
                    value={lastApproachDate ?? ''}
                    onChange={(e) => {
                      if (!milestoneUserId) return
                      patchMilestones(milestoneUserId, {
                        lastApproachDate: e.target.value || null,
                      })
                    }}
                  />
                  <p className="milestone-sub">{formatDateJa(lastApproachDate)}</p>
                  <div className="elapsed-row">
                    <span className="elapsed-label">経過</span>
                    <span className="elapsed-value">
                      {formatElapsedLabel(daysApproach)}
                    </span>
                  </div>
                  <button type="button" className="btn small" onClick={setApproachToday}>
                    今日に更新
                  </button>
                </div>
                <div className="milestone-card">
                  <h3>前回受注日</h3>
                  <input
                    type="date"
                    className="cell-input date-wide"
                    value={lastOrderDate ?? ''}
                    onChange={(e) => {
                      if (!milestoneUserId) return
                      patchMilestones(milestoneUserId, {
                        lastOrderDate: e.target.value || null,
                      })
                    }}
                  />
                  <p className="milestone-sub">{formatDateJa(lastOrderDate)}</p>
                  <div className="elapsed-row">
                    <span className="elapsed-label">経過</span>
                    <span className="elapsed-value">
                      {formatElapsedLabel(daysOrder)}
                    </span>
                  </div>
                  <button type="button" className="btn small" onClick={setOrderToday}>
                    今日に更新
                  </button>
                </div>
              </div>
            </section>
          ) : dataViewUserIds !== 'all' && dataViewUserIds.length === 0 ? (
            <section className="panel milestone-panel muted">
              <p className="hint" style={{ margin: 0 }}>
                <strong>データ表示</strong>で担当のチェックが1つも入っていません。プルダウンを開き、見たいユーザーを
                <strong>1人以上</strong>オンにしてください（<strong>自分以外だけ</strong>も可能です）。
              </p>
            </section>
          ) : dataViewUserIds !== 'all' && dataViewUserIds.length > 1 ? (
            <section className="panel milestone-panel muted">
              <p className="hint" style={{ margin: 0 }}>
                前回アプローチ日・受注日のカードは、データ表示で<strong>ちょうど1人</strong>だけ選んだときに表示されます。複数選択中もグラフや活動一覧は選択した担当分が表示されます。
              </p>
            </section>
          ) : (
            <section className="panel milestone-panel muted">
              <p className="hint" style={{ margin: 0 }}>
                上の<strong>データ表示</strong>で<strong>全員</strong>のときはここを使わず、1人だけ選ぶとその人の前回アプローチ日・前回受注日と経過が表示されます。
              </p>
            </section>
          )}

          <div
            className="panel period-mode-bar"
            role="region"
            aria-label="グラフとカードの表示単位"
          >
            <div className="period-mode-row">
              <span className="field-label">表示単位（グラフ・カード）</span>
              <div className="segmented" role="group" aria-label="月次・年次・合計">
                <button
                  type="button"
                  className={`seg-btn ${periodGroup === 'month' ? 'active' : ''}`}
                  onClick={() => setPeriodGroup('month')}
                >
                  月次
                </button>
                <button
                  type="button"
                  className={`seg-btn ${periodGroup === 'fiscalYearMarch' ? 'active' : ''}`}
                  onClick={() => setPeriodGroup('fiscalYearMarch')}
                >
                  年次（{fiscalSm}月始まり）
                </button>
                <button
                  type="button"
                  className={`seg-btn ${periodGroup === 'all' ? 'active' : ''}`}
                  onClick={() => setPeriodGroup('all')}
                >
                  合計
                </button>
              </div>
            </div>
            {periodGroup === 'month' ? (
              <div className="focus-month-row">
                <span className="field-label">カードの月</span>
                <div className="focus-month-controls">
                  <button
                    type="button"
                    className="btn small"
                    aria-label="前月"
                    disabled={focusMonthYm <= MIN_FOCUS_MONTH_YM}
                    onClick={() => bumpFocusMonth(-1)}
                  >
                    ←
                  </button>
                  <input
                    type="month"
                    className="input-month"
                    value={focusMonthYm}
                    min={MIN_FOCUS_MONTH_YM}
                    max={maxFocusMonthYm}
                    onChange={(e) => onFocusMonthInput(e.target.value)}
                    aria-label="カードで集計する暦月"
                  />
                  <button
                    type="button"
                    className="btn small"
                    aria-label="翌月"
                    disabled={focusMonthYm >= maxFocusMonthYm}
                    onClick={() => bumpFocusMonth(1)}
                  >
                    →
                  </button>
                </div>
              </div>
            ) : periodGroup === 'fiscalYearMarch' ? (
              <div className="focus-month-row dashboard-fiscal-row">
                <span className="field-label">カードの年度</span>
                <div className="focus-month-controls dashboard-fiscal-controls">
                  <button
                    type="button"
                    className="btn small"
                    onClick={() =>
                      setDashboardFiscalFocusStartYear(dashboardCurrentFy)
                    }
                  >
                    今期
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() =>
                      setDashboardFiscalFocusStartYear(dashboardCurrentFy - 1)
                    }
                  >
                    前期
                  </button>
                  <select
                    className="cell-input dashboard-fiscal-select"
                    aria-label="カードで集計する会計年度"
                    value={dashboardFiscalFocusStartYear}
                    onChange={(e) =>
                      setDashboardFiscalFocusStartYear(Number(e.target.value))
                    }
                  >
                    {activityFiscalYearsForSelect.map((fy) => {
                      const term = fiscalTermNumberForStartYear(
                        fy,
                        companySettings.anchorFiscalYearStartYear,
                        companySettings.anchorFiscalTermNumber,
                      )
                      return (
                        <option key={fy} value={fy}>
                          {fiscalYearRangeLabel(fy, fiscalSm)}（第{term}期）
                          {fy === dashboardCurrentFy ? '（今期）' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            ) : null}
            <p className="hint small period-mode-hint">
              <strong>月次</strong>のときは「<strong>カードの月</strong>」でカード・流入経路・ユーザー比較の参照月を選べます（既定は今月）。
              その下の<strong>折れ線・件数比較の棒グラフ</strong>は、<strong>各グラフの「表示終端月」</strong>までを横軸に表示します（グラフごとに変えられます。「カードの月に合わせる」で揃えられます）。
              <strong>年次</strong>は設定の<strong>会計年度の開始月</strong>に沿った年度を、<strong>カードの年度</strong>で選べます（<strong>今期</strong>・<strong>前期</strong>ボタン付き）。<strong>合計</strong>は<strong>全期間</strong>をカードと共有します。
              活動日は<strong>暦の年月</strong>で分けます（例: 4月30日の活動は「4月」にのみ含みます）。
              日付が変わったあと（タブを再度表示したとき・約1分ごと）、<strong>今月</strong>や<strong>今期の年次</strong>を見ていた場合は自動で新しい暦に合わせます（過去の月・年度を選んでいるときはそのままです）。
            </p>
          </div>

          <section className="cards" aria-label="表示単位に応じた指標">
            <p className="hint small cards-scope-banner" style={{ gridColumn: '1 / -1', margin: 0 }}>
              {cardScopeLabel}
            </p>
            <article className="card">
              <h3>営業件数（合計）</h3>
              <p className="card-value">{salesActs.toLocaleString()}</p>
              <p className="card-note">
                {activityTypeCatalog.map((row) => row.label).join('＋')}
              </p>
            </article>
            <article className="card">
              <h3>見積÷営業件数</h3>
              <p className="card-value">{rateQuotePerSales}%</p>
              <p className="card-note">100超のときあり</p>
            </article>
            <article className="card">
              <h3>受注÷見積</h3>
              <p className="card-value">{rateOrderPerQuote}%</p>
              <p className="card-note">見積0の月は0%</p>
            </article>
            {activityTypeCatalog.map((row) => (
              <article key={row.id} className="card">
                <h3>{row.label}</h3>
                <p className="card-value">
                  {(totals.activityCounts[row.id] ?? 0).toLocaleString()}
                </p>
              </article>
            ))}
            <article className="card">
              <h3>見積もり（合計）</h3>
              <p className="card-value">{totals.quotes.toLocaleString()}</p>
            </article>
            <article className="card">
              <h3>受注（合計）</h3>
              <p className="card-value">{totals.closedWon.toLocaleString()}</p>
            </article>
            <article className="card">
              <h3>アプローチ合計</h3>
              <p className="card-value">{approaches.toLocaleString()}</p>
            </article>
            <article className="card wide">
              <h3>転換率・率（表示中の集計）</h3>
              <ul className="funnel-list">
                <li>
                  営業件数に対する見積率{' '}
                  <strong>{funnel.quotesPerSalesRate}%</strong>
                </li>
                <li>
                  見積に対する受注率{' '}
                  <strong>{funnel.orderPerQuoteRate}%</strong>
                </li>
                <li>
                  アプローチ→商談 <strong>{funnel.approachToMeeting}%</strong>
                </li>
                <li>
                  商談→見積 <strong>{funnel.meetingToQuote}%</strong>
                </li>
                <li>
                  見積→受注 <strong>{funnel.quoteToWin}%</strong>
                </li>
                <li>
                  アプローチ→受注 <strong>{funnel.approachToWin}%</strong>
                </li>
              </ul>
            </article>
          </section>

          {!hasBucketedChartSource && (
            <p className="empty-chart-hint panel">
              活動を1件以上追加すると、グラフが表示されます。
            </p>
          )}

          <details className="panel chart-color-settings">
            <summary>グラフの色</summary>
            <p className="hint small chart-color-hint">
              ここで選んだ色はこのブラウザに保存され、JSON 書き出しにも含まれます。
            </p>
            <div className="chart-color-grid">
              {CHART_COLOR_KEYS.map((key) => (
                <div key={key} className="chart-color-row">
                  <label className="chart-color-label" htmlFor={`chart-color-${key}`}>
                    {CHART_COLOR_LABELS[key]}
                  </label>
                  <div className="chart-color-controls">
                    <input
                      id={`chart-color-${key}`}
                      type="color"
                      className="chart-color-swatch"
                      value={c[key]}
                      onChange={(e) => patchChartColor(key, e.target.value)}
                      aria-label={CHART_COLOR_LABELS[key]}
                    />
                    <code className="chart-color-hex">{c[key]}</code>
                  </div>
                </div>
              ))}
            </div>
            <div className="chart-color-actions">
              <button type="button" className="btn small ghost" onClick={resetChartColors}>
                色を初期値に戻す
              </button>
            </div>
          </details>

          <section className="charts charts-lead-source" aria-label="流入経路グラフ">
            <div className="panel">
              <h2>流入経路：活動件数</h2>
              <p className="hint small" style={{ marginTop: 0 }}>
                {cardScopeLabel}の活動を、報告した<strong>流入経路</strong>ごとに集計しています（活動日ベース）。
              </p>
              {hasLeadSourceChartData && leadByActivityDesc[0] ? (
                <p className="hint small lead-source-topline">
                  いちばん多いのは「<strong>{leadByActivityDesc[0].label}</strong>」
                  <span className="tabular">（{leadByActivityDesc[0].activityCount} 件）</span>。
                </p>
              ) : null}
              <div className="chart-wrap">
                {hasLeadSourceChartData ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(
                      400,
                      Math.max(200, leadByActivityDesc.length * 40),
                    )}
                  >
                    <BarChart
                      layout="vertical"
                      data={leadByActivityDesc}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke={c.chartGrid}
                      />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={132}
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]!.payload as (typeof leadByActivityDesc)[number]
                          return (
                            <div className="recharts-tooltip-inner">
                              <p className="tt-title">{d.label}</p>
                              <p>活動件数: {d.activityCount}</p>
                              <p>見積もり件数（合計）: {d.quoteSum}</p>
                              <p>見積ありの活動: {d.activitiesWithQuote} 件</p>
                            </div>
                          )
                        }}
                      />
                      <Bar
                        dataKey="activityCount"
                        name="活動件数"
                        fill={c.teleAppo}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">
                    この期間に該当する活動がありません。表示単位や「カードの月」を変えてください。
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>流入経路：見積もり件数（合計）</h2>
              <p className="hint small" style={{ marginTop: 0 }}>
                各経路で<strong>結果として記録した見積もり件数</strong>の合計です（1活動で複数見積もりもそのまま加算）。
              </p>
              {leadByQuotePositive.length > 0 && leadByQuotePositive[0] ? (
                <p className="hint small lead-source-topline">
                  いちばん多いのは「<strong>{leadByQuotePositive[0].label}</strong>」
                  <span className="tabular">
                    （見積合計 {leadByQuotePositive[0].quoteSum} 件）
                  </span>
                  。
                </p>
              ) : hasLeadSourceChartData ? (
                <p className="hint small lead-source-topline">
                  この期間に見積もり件数が記録された活動はまだありません。
                </p>
              ) : null}
              <div className="chart-wrap">
                {leadByQuotePositive.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(
                      400,
                      Math.max(200, leadByQuotePositive.length * 40),
                    )}
                  >
                    <BarChart
                      layout="vertical"
                      data={leadByQuotePositive}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke={c.chartGrid}
                      />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={132}
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]!.payload as (typeof leadByQuotePositive)[number]
                          return (
                            <div className="recharts-tooltip-inner">
                              <p className="tt-title">{d.label}</p>
                              <p>見積もり件数（合計）: {d.quoteSum}</p>
                              <p>見積ありの活動: {d.activitiesWithQuote} 件</p>
                              <p>活動件数: {d.activityCount}</p>
                            </div>
                          )
                        }}
                      />
                      <Bar
                        dataKey="quoteSum"
                        name="見積もり件数"
                        fill={c.quote}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">
                    {scopedActivitiesForLeadSource.length === 0
                      ? 'この期間に該当する活動がありません。'
                      : '見積もりが1件以上ある経路がありません。'}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="charts" aria-label="グラフ">
            <div className="panel">
              <h2>
                {periodChartTitle}：営業種類の件数推移
              </h2>
              {trendChartMonthToolbar('activityTypes')}
              <div className="chart-wrap">
                {dashboardChartSlices.activityTypes.hasData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={dashboardChartSlices.activityTypes.chartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis {...dashboardChartSlices.activityTypes.lineXAxisProps} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      {activityTypeCatalog.map((row, i) => (
                        <Line
                          key={row.id}
                          type="monotone"
                          dataKey={row.id}
                          name={row.label}
                          stroke={colorForActivityTypeId(row.id, i, c)}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">データなし</div>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>
                {periodChartTitle}：見積もり・受注の推移
              </h2>
              {trendChartMonthToolbar('quotesOrders')}
              <div className="chart-wrap">
                {dashboardChartSlices.quotesOrders.hasData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={dashboardChartSlices.quotesOrders.chartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis {...dashboardChartSlices.quotesOrders.lineXAxisProps} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="quotes"
                        name="見積もり"
                        stroke={c.quote}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="closedWon"
                        name="受注"
                        stroke={c.closedWon}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">データなし</div>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>
                {periodChartTitle}：営業あたり見積率・見積あたり受注率（％）
              </h2>
              {trendChartMonthToolbar('rates')}
              <div className="chart-wrap">
                {dashboardChartSlices.rates.hasData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={dashboardChartSlices.rates.chartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis {...dashboardChartSlices.rates.lineXAxisProps} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) =>
                          typeof value === 'number' ? [`${value}%`, ''] : ['', '']
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="quotesPerSalesRate"
                        name="見積÷営業件数"
                        stroke={c.quote}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="orderPerQuoteRate"
                        name="受注÷見積"
                        stroke={c.closedWon}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">データなし</div>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>{periodChartTitle}の転換率（％）</h2>
              {trendChartMonthToolbar('funnel')}
              <div className="chart-wrap">
                {dashboardChartSlices.funnel.hasData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={dashboardChartSlices.funnel.chartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis {...dashboardChartSlices.funnel.lineXAxisProps} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip
                        formatter={(value) =>
                          typeof value === 'number' ? [`${value}%`, ''] : ['', '']
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="approachToMeeting"
                        name="アプローチ→商談"
                        stroke={c.funnelApproachToMeeting}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="meetingToQuote"
                        name="商談→見積"
                        stroke={c.funnelMeetingToQuote}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="quoteToWin"
                        name="見積→受注"
                        stroke={c.funnelQuoteToWin}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="approachToWin"
                        name="アプローチ→受注"
                        stroke={c.funnelApproachToWin}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">データなし</div>
                )}
              </div>
            </div>
            <div className="panel full">
              <h2>
                {periodChartTitle}：件数比較（
                {activityTypeCatalog.map((row) => row.label).join('・')}
                ・見積・受注）
              </h2>
              {trendChartMonthToolbar('countsBar')}
              <div className="chart-wrap">
                {dashboardChartSlices.countsBar.hasData ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.min(
                      420,
                      Math.max(
                        260,
                        dashboardChartSlices.countsBar.barComparisonRows.length * 56,
                      ),
                    )}
                  >
                    <BarChart
                      data={dashboardChartSlices.countsBar.barComparisonRows}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis {...dashboardChartSlices.countsBar.barXAxisProps} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      {activityTypeCatalog.map((row, i) => (
                        <Bar
                          key={row.id}
                          dataKey={row.id}
                          name={row.label}
                          fill={colorForActivityTypeId(row.id, i, c)}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                      <Bar dataKey="quotes" name="見積もり" fill={c.quote} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="closedWon" name="受注" fill={c.closedWon} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-placeholder">データなし</div>
                )}
              </div>
            </div>
          </section>

          <section className="panel user-compare-section" aria-label="ユーザー別比較">
            <h2 className="user-compare-title">ユーザー別比較</h2>
            <p className="hint small user-compare-desc">
              {cardScopeLabel}
              で各営業担当の活動ログを集計しています（「自分のみ／全員」の切替とは独立し、営業・売上に含めるユーザーのみ並べます）。
            </p>
            <div className="user-compare-tablist" role="tablist" aria-label="比較する項目">
              {userCompareTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={userCompareTab === tab.id}
                  className={`user-compare-tab ${userCompareTab === tab.id ? 'active' : ''}`}
                  onClick={() => setUserCompareTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="chart-wrap user-compare-chart">
              {isLeadSourcesCompareTab(userCompareTab) ? (
                salesUsers.length === 0 ? (
                  <div className="chart-placeholder">ユーザーがありません</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={userCompareLeadStack}
                      margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {leadStackKeysFromCatalog(leadSourceCatalog).map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="lead"
                          name={leadStackLabel(key, leadSourceCatalog)}
                          fill={
                            [
                              '#2563eb',
                              '#7c3aed',
                              '#db2777',
                              '#0d9488',
                              '#d97706',
                              '#059669',
                              '#64748b',
                              '#b45309',
                            ][i] ?? '#94a3b8'
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : userCompareBarRows.length === 0 ? (
                <div className="chart-placeholder">ユーザーがありません</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={userCompareBarRows}
                    margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      allowDecimals={userCompareTabKind !== 'percent'}
                      domain={userCompareTabKind === 'percent' ? [0, 'auto'] : undefined}
                    />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === 'number' && userCompareTabKind === 'percent'
                          ? [`${value}%`, '']
                          : [value, '']
                      }
                    />
                    <Bar
                      dataKey="value"
                      name={
                        userCompareTabs.find((t) => t.id === userCompareTab)
                          ?.label ?? ''
                      }
                      fill={(() => {
                        const i = activityTypeCatalog.findIndex(
                          (x) => x.id === userCompareTab,
                        )
                        if (i >= 0) {
                          return colorForActivityTypeId(userCompareTab, i, c)
                        }
                        return userCompareTabKind === 'percent'
                          ? c.quote
                          : c.teleAppo
                      })()}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <footer className="footer">
            <p>
              {auth.configured ? (
                <>
                  ログイン中のデータは <strong>Supabase</strong> に<strong>自動保存</strong>されます（編集の約0.9秒後。タブを閉じる直前も保存）。
                  すぐ反映したいときは <strong>今すぐ保存</strong> を押してください。端末にはバックアップ用に{' '}
                  <strong>全状態JSON</strong> の書き出しも利用できます。
                </>
              ) : (
                <>
                  保存キーは <code>sales-newbiz-v8</code> です（活動ログ・請求・データ表示の複数選択・グラフの色など）。旧{' '}
                  <code>sales-newbiz-v7</code>、<code>sales-newbiz-v6</code>、<code>sales-newbiz-v5</code>、
                  <code>sales-newbiz-v4</code>{' '}
                  があれば起動時に読み替えて移行します。クラウド未設定時は同一ブラウザ内の localStorage のみです。
                </>
              )}
            </p>
          </footer>
        </div>
      </div>
        </>
      ) : pageTab === 'targets' ? (
        <TargetsTab
          targets={approachTargets}
          users={salesUsers}
          sessionUserId={sessionUserId}
          dataViewUserIds={dataViewUserIds}
          setState={setState}
          showToast={showToast}
          activities={activities}
          leadSourceCatalog={leadSourceCatalog}
        />
      ) : pageTab === 'invoices' ? (
        <InvoicesTab
          invoices={invoices}
          users={salesUsers}
          sessionUserId={sessionUserId}
          dataViewUserIds={dataViewUserIds}
          setState={setState}
          showToast={showToast}
          chartColors={chartColors}
          invoiceAnnualRevenueTargets={invoiceAnnualRevenueTargets}
          companySettings={companySettings}
        />
      ) : pageTab === 'estimates' ? (
        <EstimateTasksTab
          estimateTasks={estimateTasks}
          users={salesUsers}
          sessionUserId={sessionUserId}
          dataViewUserIds={dataViewUserIds}
          setState={setState}
          showToast={showToast}
          companySettings={companySettings}
        />
      ) : pageTab === 'attendance' ? (
        <AttendanceTab
          users={users}
          sessionUserId={sessionUserId}
          attendanceRecords={attendanceRecords}
          attendanceCorrectionPasswordHash={attendanceCorrectionPasswordHash}
          setState={setState}
          showToast={showToast}
        />
      ) : pageTab === 'settings' ? (
        <SettingsTab
          users={users}
          companySettings={companySettings}
          leadSourceCatalog={leadSourceCatalog}
          activityTypeCatalog={activityTypeCatalog}
          attendanceAdminUserIds={attendanceAdminUserIds}
          attendanceCorrectionPasswordHash={attendanceCorrectionPasswordHash}
          setState={setState}
          showToast={showToast}
          onResetSample={onResetSample}
          onClearAll={onClearAll}
        />
      ) : null}
        </>
      )}
    </div>
  )
}

function AppMain() {
  const { state, setState, toast, showToast, dataReady, cloudSave, forceCloudSave } =
    usePersistentAppState()
  if (!dataReady) {
    return (
      <div className="app-auth-loading app-data-loading" role="status" aria-busy="true">
        データを読み込んでいます…
      </div>
    )
  }
  return (
    <DashboardApp
      state={state}
      setState={setState}
      toast={toast}
      showToast={showToast}
      cloudSave={cloudSave}
      forceCloudSave={forceCloudSave}
    />
  )
}

export default function App() {
  const auth = useAuth()
  if (!auth.ready) {
    return (
      <div className="app-auth-loading" role="status" aria-busy="true">
        起動準備中…
      </div>
    )
  }
  if (auth.configured && !auth.user) {
    return <CloudLoginScreen />
  }
  return (
    <>
      {!auth.configured && import.meta.env.PROD && (
        <div className="app-prod-missing-supabase-banner" role="status">
          本番ビルドに{' '}
          <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          が含まれていないため、クラウドログインは表示されません。Vercel の
          Environment Variables で <strong>Production</strong>{' '}
          にチェックを入れて保存し、<strong>Redeploy</strong>（再デプロイ）してください。
        </div>
      )}
      <AppMain />
    </>
  )
}
