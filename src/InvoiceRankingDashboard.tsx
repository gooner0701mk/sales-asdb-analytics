import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartColorPalette } from './chartColors'
import { todayIsoDate } from './dates'
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
import { teamInvoiceTotalYen } from './invoiceMetrics'
import { formatYmJa } from './metrics'
import { fyStartYearFromCalendarYm } from './fiscalYear'
import { dataViewSummaryLabel } from './dataViewSelection'
import { useInvoiceCalendarPeriodAutoSync } from './useInvoiceCalendarPeriodAutoSync'
import { useMediaQuery } from './useMediaQuery'
import { PieWithHoverOrTap } from './PieWithHoverOrTap'
import type { CompanySettings, DataViewUserIds, Invoice, User } from './types'

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
  dataViewUserIds: DataViewUserIds
  chartColors: ChartColorPalette
  companySettings: CompanySettings
}

export function InvoiceRankingDashboard({
  invoices,
  users,
  dataViewUserIds,
  chartColors: c,
  companySettings,
}: Props) {
  const todayYm = todayIsoDate().slice(0, 7)
  const fiscalSm = companySettings.fiscalYearStartMonth
  const defaultFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)

  const [periodMode, setPeriodMode] = useState<InvoicePeriodMode>('month')
  const [focusYm, setFocusYm] = useState(todayYm)
  const [focusFyStartYear, setFocusFyStartYear] = useState(defaultFy)

  useEffect(() => {
    setFocusFyStartYear(
      fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), fiscalSm),
    )
  }, [fiscalSm])

  useInvoiceCalendarPeriodAutoSync({
    fiscalYearStartMonth: fiscalSm,
    setFocusYm,
    setFocusFyStartYear,
  })

  const visibleInvoices = useMemo(() => {
    if (dataViewUserIds === 'all') return invoices
    return invoices.filter((i) => dataViewUserIds.includes(i.userId))
  }, [invoices, dataViewUserIds])

  const periodInvoices = useMemo(() => {
    if (periodMode === 'month') {
      return filterInvoicesByCalendarMonth(visibleInvoices, focusYm)
    }
    return filterInvoicesByFiscalYear(visibleInvoices, focusFyStartYear, fiscalSm)
  }, [visibleInvoices, periodMode, focusYm, focusFyStartYear, fiscalSm])

  const periodLabel = useMemo(() => {
    if (periodMode === 'month') return formatYmJa(focusYm)
    return fiscalYearLabel(focusFyStartYear, fiscalSm)
  }, [periodMode, focusYm, focusFyStartYear, fiscalSm])

  const fyOptions = useMemo(() => {
    const fromData = uniqueSortedFiscalYearsDesc(invoices, fiscalSm)
    const set = new Set(fromData)
    set.add(defaultFy)
    set.add(focusFyStartYear)
    return [...set].sort((a, b) => b - a)
  }, [invoices, fiscalSm, defaultFy, focusFyStartYear])

  const userRanking = useMemo(
    () => rankedUsersByInvoiceTotal(periodInvoices, users),
    [periodInvoices, users],
  )

  const barRows = useMemo(
    () =>
      userRanking.map((r) => ({
        name: r.displayName,
        totalYen: r.totalYen,
        share: r.shareOfTeamPercent,
      })),
    [userRanking],
  )

  const clientTop10 = useMemo(
    () => topClientSharesByScopeRevenue(periodInvoices, 10),
    [periodInvoices],
  )

  const scopeTotal = teamInvoiceTotalYen(periodInvoices)

  /** 取引先シェア用円グラフ（TOP10＋残りを「その他」） */
  const clientSharePieSlices = useMemo(() => {
    if (clientTop10.length === 0) return []
    const topSum = clientTop10.reduce((s, r) => s + r.totalYen, 0)
    const slices = clientTop10.map((r) => ({
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
  }, [clientTop10, scopeTotal])

  const top5UsersForPies = useMemo(() => userRanking.slice(0, 5), [userRanking])

  const pieSlicesByUser = useMemo(() => {
    const m = new Map<string, ReturnType<typeof userTopClientPieSlices>>()
    for (const u of top5UsersForPies) {
      m.set(u.userId, userTopClientPieSlices(u.userId, periodInvoices, 5))
    }
    return m
  }, [top5UsersForPies, periodInvoices])

  const emptySelection =
    dataViewUserIds !== 'all' && dataViewUserIds.length === 0

  /** マウスホバー前提の環境ではホバーでツールチップ。タッチ中心ではタップ＋下のパネル */
  const pieTooltipFinePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  const companySharePieTooltip = useCallback((props: Record<string, unknown>) => {
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
          <div className="muted">表示スコープ内シェア: {share}％</div>
        ) : null}
      </div>
    )
  }, [])

  const pieTooltip = useCallback((props: Record<string, unknown>) => {
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
          <div className="muted">この担当の期間内合計: {share}％</div>
        ) : null}
      </div>
    )
  }, [])

  return (
    <section className="panel invoice-rankings-section" aria-label="売上データ（請求ベース）の社内ランキング">
      <h2 className="user-compare-title">売上データ（請求ベース）・社内ランキング</h2>
      <p className="hint small user-compare-desc">
        <strong>データ表示の範囲</strong>（{dataViewSummaryLabel(dataViewUserIds, users)}
        ）に含まれる請求のみを、下の期間で絞り込んで集計しています。
      </p>

      <div className="invoices-period-bar" role="group" aria-label="ランキング集計期間">
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
        <span className="muted small invoice-rankings-period-caption">
          表示中: <strong>{periodLabel}</strong>
          {scopeTotal > 0 ? `（合計 ${formatYen(scopeTotal)}）` : '（請求なし）'}
        </span>
      </div>
      <p className="hint small" style={{ marginTop: '0.35rem' }}>
        暦が進み<strong>今月</strong>・<strong>今期（会計年度）</strong>を見ていた場合は自動で切り替わります（過去を選んでいる場合はそのままです）。
      </p>

      {emptySelection ? (
        <div className="chart-placeholder">ユーザーを選択してください</div>
      ) : (
        <>
          <h3 className="invoice-rankings-subheading">担当ランキング（請求額・縦棒）</h3>
          <div className="chart-wrap">
            {barRows.length === 0 ? (
              <div className="chart-placeholder">この期間の請求がありません</div>
            ) : (
              <div className="invoice-rankings-rc-host">
                <ResponsiveContainer
                  width="100%"
                  height={Math.min(420, Math.max(280, 56 + barRows.length * 36))}
                  debounce={80}
                  minWidth={0}
                >
                  <BarChart
                    data={barRows}
                    margin={{ top: 8, right: 12, left: 4, bottom: 72 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={c.chartGrid} />
                    <XAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={68}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const n = Number(v)
                        if (!Number.isFinite(n) || n < 0) return ''
                        if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`
                        if (n >= 10000) return `${Math.round(n / 10000)}万`
                        return String(n)
                      }}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === 'number' ? value : Number(value)
                        return [formatYen(Number.isFinite(n) ? n : 0), '請求額']
                      }}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="totalYen" name="請求額" radius={[5, 5, 0, 0]}>
                      {barRows.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <h3 className="invoice-rankings-subheading">
            取引先シェア率（表示スコープ内・TOP10＋その他）
          </h3>
          <p className="hint small invoice-rankings-pie-hint">
            取引先名と割合は、PC
            ではスライスにカーソルを合わせると表示されます。スマホ・タブレットではスライスをタップすると<strong>グラフの下</strong>に詳細が出ます（閉じるで消えます）。
          </p>
          {clientSharePieSlices.length === 0 ? (
            <div className="chart-placeholder">この期間の請求がありません</div>
          ) : (
            <div className="invoice-rankings-rc-host invoice-rankings-share-pie-wrap">
              <PieWithHoverOrTap
                data={clientSharePieSlices}
                height={320}
                colors={PIE_COLORS}
                isFinePointer={pieTooltipFinePointer}
                tooltipContent={companySharePieTooltip}
                formatYen={formatYen}
                mobileFootnote={(d) =>
                  typeof d.sharePercent === 'number'
                    ? `表示スコープ内シェア: ${d.sharePercent}％`
                    : null
                }
                cx="50%"
                cy="48%"
                outerRadius={108}
                paddingAngle={1}
                isAnimationActive={false}
                legend={<Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" />}
                debounceMs={80}
                minWidth={0}
              />
            </div>
          )}

          <h3 className="invoice-rankings-subheading">
            請求額が多い担当上位5名の取引先構成（各取引先TOP5＋その他）
          </h3>
          <p className="hint small invoice-rankings-pie-hint">
            各グラフも同様です（PC はホバー、スマホ・タブレットはタップでグラフ下に詳細）。
          </p>
          {top5UsersForPies.length === 0 ? (
            <div className="chart-placeholder">この期間の請求がありません</div>
          ) : (
            <div className="invoice-rankings-pie-grid">
              {top5UsersForPies.map((u) => {
                const slices = pieSlicesByUser.get(u.userId) ?? []
                return (
                  <div key={u.userId} className="invoice-rankings-pie-card">
                    <h4 className="invoice-rankings-pie-title">{u.displayName}</h4>
                    <p className="hint small invoice-rankings-pie-meta">
                      期間内合計 {formatYen(u.totalYen)}
                    </p>
                    {slices.length === 0 ? (
                      <div className="chart-placeholder">データなし</div>
                    ) : (
                      <div className="invoice-rankings-rc-host invoice-rankings-pie-rc">
                        <PieWithHoverOrTap
                          data={slices}
                          height={220}
                          colors={PIE_COLORS}
                          isFinePointer={pieTooltipFinePointer}
                          tooltipContent={pieTooltip}
                          formatYen={formatYen}
                          mobileFootnote={(d) =>
                            typeof d.shareOfUserPercent === 'number'
                              ? `この担当の期間内合計: ${d.shareOfUserPercent}％`
                              : null
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={78}
                          paddingAngle={1}
                          isAnimationActive={false}
                          debounceMs={80}
                          minWidth={0}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
