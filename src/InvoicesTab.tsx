import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatDateJa, todayIsoDate } from './dates'
import {
  type InvoicePeriodMode,
  filterInvoicesByCalendarMonth,
  filterInvoicesByFiscalYear,
  fiscalYearLabel,
  uniqueSortedFiscalYearsDesc,
} from './invoicePeriod'
import {
  rankedUsersByInvoiceTotal,
  topClientSharesByScopeRevenue,
  userTopClientPieSlices,
} from './invoiceRankingsModel'
import {
  summarizeInvoicesByUser,
  teamInvoiceTotalYen,
} from './invoiceMetrics'
import type { ChartColorPalette } from './chartColors'
import { InvoiceRankingDashboard } from './InvoiceRankingDashboard'
import { formatYmJa } from './metrics'
import { fyStartYearFromCalendarYm } from './fiscalYear'
import { DataViewUserSelectBar } from './DataViewUserSelectBar'
import { dataViewShowsOwnerColumn } from './dataViewSelection'
import { InvoiceRevenueTargetSidebar } from './InvoiceRevenueTargetSidebar'
import { SectionErrorBoundary } from './SectionErrorBoundary'
import { useInvoiceCalendarPeriodAutoSync } from './useInvoiceCalendarPeriodAutoSync'
import { useMediaQuery } from './useMediaQuery'
import type {
  AppState,
  CompanySettings,
  DataViewUserIds,
  Invoice,
  User,
} from './types'
import { newInvoice } from './types'

const PIE_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#0d9488',
  '#ea580c',
  '#4f46e5',
  '#0ea5e9',
  '#65a30d',
]

function formatYen(n: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n)
}

type Props = {
  invoices: Invoice[]
  users: User[]
  sessionUserId: string | null
  dataViewUserIds: DataViewUserIds
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
  chartColors: ChartColorPalette
  invoiceAnnualRevenueTargets: AppState['invoiceAnnualRevenueTargets']
  companySettings: CompanySettings
}

export function InvoicesTab({
  invoices,
  users,
  sessionUserId,
  dataViewUserIds,
  setState,
  showToast,
  chartColors,
  invoiceAnnualRevenueTargets,
  companySettings,
}: Props) {
  const todayYm = todayIsoDate().slice(0, 7)
  const fiscalSm = companySettings.fiscalYearStartMonth
  const defaultFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)

  const [periodMode, setPeriodMode] = useState<InvoicePeriodMode>('month')
  const [focusYm, setFocusYm] = useState(todayYm)
  const [focusFyStartYear, setFocusFyStartYear] = useState(defaultFy)

  useInvoiceCalendarPeriodAutoSync({
    fiscalYearStartMonth: fiscalSm,
    setFocusYm,
    setFocusFyStartYear,
  })

  useEffect(() => {
    setFocusFyStartYear(
      fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), fiscalSm),
    )
  }, [fiscalSm])

  const [formDate, setFormDate] = useState(() => todayIsoDate())
  const [formClient, setFormClient] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formMemo, setFormMemo] = useState('')
  const [formUserId, setFormUserId] = useState(() => sessionUserId ?? '')

  useEffect(() => {
    if (sessionUserId && !users.some((u) => u.id === formUserId)) {
      setFormUserId(sessionUserId)
    }
  }, [sessionUserId, users, formUserId])

  const periodLabel = useMemo(() => {
    if (periodMode === 'month') {
      return formatYmJa(focusYm)
    }
    return fiscalYearLabel(focusFyStartYear, fiscalSm)
  }, [periodMode, focusYm, focusFyStartYear, fiscalSm])

  const periodAllInvoices = useMemo(() => {
    if (periodMode === 'month') {
      return filterInvoicesByCalendarMonth(invoices, focusYm)
    }
    return filterInvoicesByFiscalYear(invoices, focusFyStartYear, fiscalSm)
  }, [invoices, periodMode, focusYm, focusFyStartYear, fiscalSm])

  const visibleInvoices = useMemo(() => {
    if (dataViewUserIds === 'all') return invoices
    return invoices.filter((i) => dataViewUserIds.includes(i.userId))
  }, [invoices, dataViewUserIds])

  const showOwnerCol = dataViewShowsOwnerColumn(dataViewUserIds)

  const periodVisibleInvoices = useMemo(() => {
    if (periodMode === 'month') {
      return filterInvoicesByCalendarMonth(visibleInvoices, focusYm)
    }
    return filterInvoicesByFiscalYear(
      visibleInvoices,
      focusFyStartYear,
      fiscalSm,
    )
  }, [visibleInvoices, periodMode, focusYm, focusFyStartYear, fiscalSm])

  const teamTotalInPeriod = teamInvoiceTotalYen(periodAllInvoices)
  const scopeTotal = teamInvoiceTotalYen(periodVisibleInvoices)

  const byUserRows = useMemo(
    () => summarizeInvoicesByUser(periodVisibleInvoices, users),
    [periodVisibleInvoices, users],
  )

  const clientTop10ForScope = useMemo(
    () => topClientSharesByScopeRevenue(periodVisibleInvoices, 10),
    [periodVisibleInvoices],
  )

  const clientScopePieSlices = useMemo(() => {
    if (clientTop10ForScope.length === 0) return []
    const topSum = clientTop10ForScope.reduce((s, r) => s + r.totalYen, 0)
    const slices = clientTop10ForScope.map((r) => ({
      name: r.clientName,
      value: r.totalYen,
      sharePercent: r.shareOfScopePercent,
    }))
    const rest = scopeTotal - topSum
    if (rest > 0 && scopeTotal > 0) {
      slices.push({
        name: 'その他（11位以下）',
        value: rest,
        sharePercent: Math.round((rest / scopeTotal) * 1000) / 10,
      })
    }
    return slices
  }, [clientTop10ForScope, scopeTotal])

  const rankedUsersForClientPies = useMemo(
    () => rankedUsersByInvoiceTotal(periodVisibleInvoices, users),
    [periodVisibleInvoices, users],
  )

  const userClientPieSlicesByUserId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof userTopClientPieSlices>>()
    for (const u of rankedUsersForClientPies) {
      m.set(u.userId, userTopClientPieSlices(u.userId, periodVisibleInvoices, 5))
    }
    return m
  }, [rankedUsersForClientPies, periodVisibleInvoices])

  const soloViewUserId =
    dataViewUserIds !== 'all' && dataViewUserIds.length === 1
      ? dataViewUserIds[0]
      : null
  const myTotalInPeriod =
    soloViewUserId !== null
      ? periodAllInvoices
          .filter((i) => i.userId === soloViewUserId)
          .reduce((s, i) => s + i.amountYen, 0)
      : null
  const shareOfTeamWhenSelf =
    myTotalInPeriod !== null && teamTotalInPeriod > 0
      ? Math.round((myTotalInPeriod / teamTotalInPeriod) * 1000) / 10
      : null

  const narrowLayout = useMediaQuery('(max-width: 960px)')

  const pieByUser = useMemo(
    () =>
      byUserRows
        .filter((r) => r.totalYen > 0)
        .map((r) => ({
          name: r.displayName,
          value: r.totalYen,
          share: r.shareOfTeamPercent,
        })),
    [byUserRows],
  )

  const fyOptions = useMemo(() => {
    const fromData = uniqueSortedFiscalYearsDesc(invoices, fiscalSm)
    const set = new Set(fromData)
    set.add(defaultFy)
    set.add(focusFyStartYear)
    return [...set].sort((a, b) => b - a)
  }, [invoices, fiscalSm, defaultFy, focusFyStartYear])

  const sortedPeriodVisible = useMemo(() => {
    return [...periodVisibleInvoices].sort((a, b) => {
      if (a.invoiceDate !== b.invoiceDate) {
        return a.invoiceDate < b.invoiceDate ? 1 : -1
      }
      return b.id.localeCompare(a.id)
    })
  }, [periodVisibleInvoices])

  const addInvoice = (e: FormEvent) => {
    e.preventDefault()
    const uid = formUserId || sessionUserId
    if (!uid) {
      showToast('分析タブで「記録する担当」を選んでから追加してください')
      return
    }
    const amt = Number.parseInt(String(formAmount).replace(/[,，]/g, ''), 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('請求金額は正の整数（円）で入力してください')
      return
    }
    const row = newInvoice(uid, formDate, formClient, amt, formMemo)
    setState((prev) => ({ ...prev, invoices: [...prev.invoices, row] }))
    setFormClient('')
    setFormAmount('')
    setFormMemo('')
    setFormDate(todayIsoDate())
    showToast('請求を追加しました')
  }

  const patchInvoice = (id: string, patch: Partial<Invoice>) => {
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...patch } : inv,
      ),
    }))
  }

  const removeInvoice = (id: string) => {
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((inv) => inv.id !== id),
    }))
    showToast('削除しました')
  }

  const pieTooltipByUser = (props: Record<string, unknown>) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) {
      return null
    }
    const p = props.payload[0] as {
      name?: string | number
      value?: number
      payload?: { share?: number }
    }
    const v = typeof p.value === 'number' ? p.value : 0
    const share = p.payload?.share
    return (
      <div className="invoices-pie-tooltip">
        <div className="invoices-pie-tooltip-name">{String(p.name ?? '')}</div>
        <div>{formatYen(v)}</div>
        {typeof share === 'number' ? (
          <div className="muted">表示中の合計に対する割合: {share}％</div>
        ) : null}
      </div>
    )
  }

  const pieTooltipCompanyClientShare = useCallback((props: Record<string, unknown>) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) {
      return null
    }
    const entry = props.payload[0] as {
      name?: string | number
      value?: number
      payload?: { sharePercent?: number; value?: number }
    }
    const nested = entry?.payload
    const share =
      typeof nested?.sharePercent === 'number'
        ? nested.sharePercent
        : typeof (entry as { sharePercent?: number }).sharePercent === 'number'
          ? (entry as { sharePercent: number }).sharePercent
          : undefined
    const rawV = entry?.value ?? nested?.value
    const v = typeof rawV === 'number' ? rawV : Number(rawV)
    const safe = Number.isFinite(v) ? v : 0
    return (
      <div className="invoices-pie-tooltip">
        <div className="invoices-pie-tooltip-name">{String(entry?.name ?? '')}</div>
        <div>{formatYen(safe)}</div>
        {typeof share === 'number' ? (
          <div className="muted">表示中の合計に対する割合: {share}％</div>
        ) : null}
      </div>
    )
  }, [])

  const pieTooltipUserClientShare = useCallback((props: Record<string, unknown>) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) {
      return null
    }
    const entry = props.payload[0] as {
      name?: string | number
      value?: number
      payload?: { shareOfUserPercent?: number; name?: string; value?: number }
    }
    const nested = entry?.payload
    const share =
      typeof nested?.shareOfUserPercent === 'number'
        ? nested.shareOfUserPercent
        : typeof (entry as { shareOfUserPercent?: number }).shareOfUserPercent === 'number'
          ? (entry as { shareOfUserPercent: number }).shareOfUserPercent
          : undefined
    const rawV = entry?.value ?? nested?.value
    const v = typeof rawV === 'number' ? rawV : Number(rawV)
    const safe = Number.isFinite(v) ? v : 0
    return (
      <div className="invoices-pie-tooltip">
        <div className="invoices-pie-tooltip-name">{String(entry?.name ?? nested?.name ?? '')}</div>
        <div>{formatYen(safe)}</div>
        {typeof share === 'number' ? (
          <div className="muted">この担当の期間内合計に対する割合: {share}％</div>
        ) : null}
      </div>
    )
  }, [])

  return (
    <div className="targets-tab invoices-tab">
      <DataViewUserSelectBar
        users={users}
        dataViewUserIds={dataViewUserIds}
        setState={setState}
      />
      <div className="invoices-tab-split">
        {narrowLayout ? (
          <details className="mobile-input-drawer" open>
            <summary className="mobile-input-drawer-summary">
              年次売上目標の入力（タップで開閉）
            </summary>
            <div className="mobile-input-drawer-body mobile-input-drawer-body--flush">
              <InvoiceRevenueTargetSidebar
                users={users}
                invoices={invoices}
                targets={invoiceAnnualRevenueTargets}
                setState={setState}
                showToast={showToast}
                companySettings={companySettings}
              />
            </div>
          </details>
        ) : (
          <InvoiceRevenueTargetSidebar
            users={users}
            invoices={invoices}
            targets={invoiceAnnualRevenueTargets}
            setState={setState}
            showToast={showToast}
            companySettings={companySettings}
          />
        )}
        <div className="invoices-tab-main">
      {(() => {
        const invoiceIntroPanel = (
      <section className="panel">
        <h2 className="targets-heading">売上データ（請求ベース）</h2>
        <p className="hint">
          <strong>上のデータ表示プルダウン</strong>と分析タブの<strong>記録する担当</strong>に連動して、集計対象の請求が切り替わります（保存データとも同期）。
          下の期間切替で<strong>各月</strong>または<strong>年度（設定の会計年度開始月に準拠）</strong>を選ぶと、合計・一覧・シェアの円グラフがその範囲に絞り込まれます。
          担当別の円グラフは<strong>表示中の請求合計</strong>に対する内訳、取引先シェアは<strong>表示中の合計に対する取引先の割合</strong>（会社全体のイメージ）と、<strong>各担当の期間合計に対する取引先の割合</strong>です。
          円グラフの詳細（名前・金額・％）は、各スライスに<strong>カーソルを合わせたときだけ</strong>表示されます。
          {soloViewUserId !== null && teamTotalInPeriod > 0 && shareOfTeamWhenSelf !== null ? (
            <>
              {' '}
              この期間の<strong>全員合計に占める表示中ユーザーの割合</strong>は <strong>{shareOfTeamWhenSelf}％</strong>（
              {formatYen(myTotalInPeriod!)} / {formatYen(teamTotalInPeriod)}）です。
            </>
          ) : null}
        </p>

        <form className="targets-add-form" onSubmit={addInvoice}>
          <label className="field inline">
            <span className="field-label">請求日</span>
            <input
              type="date"
              className="cell-input"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </label>
          <label className="field inline">
            <span className="field-label">取引先</span>
            <input
              type="text"
              className="cell-input grow"
              value={formClient}
              onChange={(e) => setFormClient(e.target.value)}
              placeholder="請求先名"
              required
            />
          </label>
          <label className="field inline">
            <span className="field-label">金額（円）</span>
            <input
              type="text"
              inputMode="numeric"
              className="cell-input"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="例：1200000"
              required
            />
          </label>
          <label className="field inline">
            <span className="field-label">担当</span>
            <select
              className="cell-input"
              value={formUserId || sessionUserId || ''}
              onChange={(e) => setFormUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field inline">
            <span className="field-label">メモ</span>
            <input
              type="text"
              className="cell-input grow"
              value={formMemo}
              onChange={(e) => setFormMemo(e.target.value)}
              placeholder="任意"
            />
          </label>
          <button type="submit" className="btn primary">
            請求を追加
          </button>
        </form>
      </section>
        )
        return narrowLayout ? (
          <details className="mobile-input-drawer" open>
            <summary className="mobile-input-drawer-summary">
              請求データの追加・説明（タップで開閉）
            </summary>
            <div className="mobile-input-drawer-body">{invoiceIntroPanel}</div>
          </details>
        ) : (
          invoiceIntroPanel
        )
      })()}

      <section className="panel targets-table-panel">
        <div className="invoices-period-bar" role="group" aria-label="集計期間">
          <span className="invoices-period-bar-label">集計単位</span>
          <div className="segmented invoices-period-seg">
            <button
              type="button"
              className={`seg-btn ${periodMode === 'month' ? 'active' : ''}`}
              onClick={() => setPeriodMode('month')}
            >
              各月
            </button>
            <button
              type="button"
              className={`seg-btn ${periodMode === 'fiscalYearMarch' ? 'active' : ''}`}
              onClick={() => setPeriodMode('fiscalYearMarch')}
            >
              年度（{fiscalSm}月始まり）
            </button>
          </div>
          {periodMode === 'month' ? (
            <label className="field inline invoices-period-picker">
              <span className="field-label">対象月</span>
              <input
                type="month"
                className="cell-input"
                value={focusYm}
                onChange={(e) => setFocusYm(e.target.value || todayYm)}
              />
            </label>
          ) : (
            <label className="field inline invoices-period-picker">
              <span className="field-label">対象年度</span>
              <select
                className="cell-input grow"
                value={focusFyStartYear}
                onChange={(e) => setFocusFyStartYear(Number(e.target.value))}
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fiscalYearLabel(fy, fiscalSm)}
                    {fy === defaultFy ? '（今期）' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="hint small" style={{ margin: '0.35rem 0 0' }}>
          暦が進み<strong>今月</strong>や<strong>今期（会計年度）</strong>が変わったとき、それらを見ていた場合は自動で切り替わります（過去の月・年度を選んでいるときはそのままです）。
        </p>

        <h3 className="invoices-subheading">表示中の合計（{periodLabel}）</h3>
        <p className="invoices-kpi">
          <span className="invoices-kpi-main">{formatYen(scopeTotal)}</span>
          <span className="muted">
            （{periodVisibleInvoices.length} 件
            {dataViewUserIds !== 'all' && teamTotalInPeriod !== scopeTotal
              ? ` ・ この期間の全員合計 ${formatYen(teamTotalInPeriod)}`
              : ''}
            ）
          </span>
        </p>

        <div className="invoices-pie-section">
          <h3 className="invoices-subheading">担当別シェア（円グラフ）</h3>
          {pieByUser.length === 0 ? (
            <p className="hint small invoices-pie-empty">
              この期間・表示範囲に請求がありません。請求を追加するか、月／年度・「全員」を切り替えてください。
            </p>
          ) : (
            <div className="invoices-pie-single" aria-label="担当別の請求金額の内訳">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieByUser}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={100}
                    paddingAngle={1}
                    isAnimationActive={false}
                  >
                    {pieByUser.map((_, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="var(--surface)"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={pieTooltipByUser}
                    trigger="hover"
                    isAnimationActive={false}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => String(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <h3 className="invoices-subheading">担当別（金額・件数）</h3>
        <div className="table-scroll">
          <table className="data-table targets-table">
            <thead>
              <tr>
                <th>担当</th>
                <th>件数</th>
                <th>請求合計</th>
              </tr>
            </thead>
            <tbody>
              {byUserRows.every((r) => r.count === 0) ? (
                <tr>
                  <td colSpan={3} className="targets-empty">
                    表示範囲に請求がありません。
                  </td>
                </tr>
              ) : (
                byUserRows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.displayName}</td>
                    <td>{r.count}</td>
                    <td className="num">{formatYen(r.totalYen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="invoices-pie-section">
          <h3 className="invoices-subheading">取引先別シェア（表示中の合計に対する割合）</h3>
          <p className="hint small">
            取引先ごとの請求合計が、上記「表示中の合計」（{formatYen(scopeTotal)}）の何％かを示します。取引先は金額上位10件と「その他（11位以下）」にまとめています。
          </p>
          {clientScopePieSlices.length === 0 ? (
            <p className="hint small invoices-pie-empty">
              この期間・表示範囲に請求がありません。請求を追加するか、月／年度・「全員」を切り替えてください。
            </p>
          ) : (
            <div className="invoices-pie-single" aria-label="取引先別の表示中合計に対するシェア">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={clientScopePieSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={100}
                    paddingAngle={1}
                    isAnimationActive={false}
                  >
                    {clientScopePieSlices.map((_, i) => (
                      <Cell
                        key={`scope-client-${i}`}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="var(--surface)"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={pieTooltipCompanyClientShare}
                    trigger="hover"
                    isAnimationActive={false}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => String(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <h3 className="invoices-subheading">担当別・取引先シェア（各担当の期間合計に対する割合）</h3>
        <p className="hint small">
          各担当について、取引先ごとの請求がその担当の期間合計に占める割合です（各円グラフの合計は100％）。取引先は金額上位5件と「その他」にまとめています。
          取引先名はスライスに<strong>カーソルを合わせたとき</strong>に表示されます。
        </p>
        {rankedUsersForClientPies.length === 0 ? (
          <p className="hint small invoices-pie-empty">
            この期間・表示範囲に担当別の取引先シェアを表示できる請求がありません。
          </p>
        ) : (
          <div
            className="invoices-client-pie-grid invoices-client-pie-grid--scroll"
            role="region"
            aria-label="担当別の取引先シェア"
          >
            {rankedUsersForClientPies.map((u) => {
              const pieData = userClientPieSlicesByUserId.get(u.userId) ?? []
              return (
                <div key={u.userId} className="invoices-client-pie-card">
                  <div className="invoices-client-pie-title">{u.displayName}</div>
                  <div className="muted invoices-client-pie-sub">
                    担当の期間合計 {formatYen(u.totalYen)}
                  </div>
                  {pieData.length === 0 ? (
                    <p className="hint small">内訳なし</p>
                  ) : (
                    <div className="invoices-pie-mini-wrap invoices-pie-mini-wrap--client-share">
                      <ResponsiveContainer width="100%" height={228} debounce={80}>
                        <PieChart margin={{ top: 14, right: 10, bottom: 14, left: 10 }}>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={68}
                            paddingAngle={1}
                            isAnimationActive={false}
                          >
                            {pieData.map((_, i) => (
                              <Cell
                                key={`uc-${u.userId}-${i}`}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                                stroke="var(--surface)"
                                strokeWidth={1}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={pieTooltipUserClientShare}
                            trigger="hover"
                            isAnimationActive={false}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel targets-table-panel">
        <h3 className="invoices-subheading">
          請求一覧（{periodLabel}・新しい日付順）
        </h3>
        <div className="table-scroll">
          <table className="data-table targets-table">
            <thead>
              <tr>
                <th>請求日</th>
                <th>取引先</th>
                <th>金額</th>
                {showOwnerCol && <th>担当</th>}
                <th>メモ</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {sortedPeriodVisible.length === 0 ? (
                <tr>
                  <td
                    colSpan={showOwnerCol ? 6 : 5}
                    className="targets-empty"
                  >
                    {invoices.length === 0
                      ? '請求がまだありません。上のフォームから登録できます。'
                      : 'この期間・表示範囲に該当する請求がありません。月／年度や「全員」を切り替えてください。'}
                  </td>
                </tr>
              ) : (
                sortedPeriodVisible.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <input
                        type="date"
                        className="cell-input"
                        value={inv.invoiceDate}
                        onChange={(e) =>
                          patchInvoice(inv.id, { invoiceDate: e.target.value })
                        }
                      />
                      <span className="ym-sub">{formatDateJa(inv.invoiceDate)}</span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="cell-input table-cell-wide"
                        value={inv.clientName}
                        onChange={(e) =>
                          patchInvoice(inv.id, { clientName: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="cell-input num"
                        value={inv.amountYen}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          patchInvoice(inv.id, {
                            amountYen: Number.isFinite(n)
                              ? Math.max(0, Math.round(n))
                              : inv.amountYen,
                          })
                        }}
                      />
                    </td>
                    {showOwnerCol && (
                      <td>
                        <select
                          className="cell-input"
                          value={inv.userId}
                          onChange={(e) =>
                            patchInvoice(inv.id, { userId: e.target.value })
                          }
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td>
                      <input
                        type="text"
                        className="cell-input table-cell-wide"
                        value={inv.memo}
                        onChange={(e) => patchInvoice(inv.id, { memo: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn icon danger"
                        onClick={() => removeInvoice(inv.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SectionErrorBoundary title="売上データ（請求ベース）・社内ランキング">
        <InvoiceRankingDashboard
          invoices={invoices}
          users={users}
          dataViewUserIds={dataViewUserIds}
          chartColors={chartColors}
          companySettings={companySettings}
        />
      </SectionErrorBoundary>
        </div>
      </div>
    </div>
  )
}
