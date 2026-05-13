import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { filterInvoicesByFiscalYear, fiscalYearLabel, uniqueSortedFiscalYearsDesc } from './invoicePeriod'
import { teamInvoiceTotalYen } from './invoiceMetrics'
import { todayIsoDate } from './dates'
import { fyStartYearFromCalendarYm } from './fiscalYear'
import { useInvoiceTargetFyAutoSync } from './useInvoiceCalendarPeriodAutoSync'
import type { AppState, CompanySettings, Invoice, InvoiceAnnualRevenueTargetBundle, User } from './types'

function formatYen(n: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n)
}

function parseYenInput(raw: string): number {
  const s = raw.replace(/[,，\s]/g, '').trim()
  if (!s) return 0
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function monthlyFromAnnual(annualYen: number): number {
  if (annualYen <= 0) return 0
  return Math.round(annualYen / 12)
}

function CrowdfundGauge({
  title,
  subtitle,
  actualYen,
  targetAnnualYen,
}: {
  title: string
  subtitle?: string
  actualYen: number
  targetAnnualYen: number
}) {
  const hasTarget = targetAnnualYen > 0
  const ratio = hasTarget ? actualYen / targetAnnualYen : 0
  const pctDisplay = hasTarget ? Math.round(ratio * 1000) / 10 : null
  const barWidthPct = hasTarget ? Math.min(100, ratio * 100) : 0
  const over = hasTarget && actualYen > targetAnnualYen

  return (
    <div className="cf-gauge">
      <div className="cf-gauge-title-row">
        <span className="cf-gauge-title">{title}</span>
        {subtitle ? <span className="cf-gauge-sub muted">{subtitle}</span> : null}
      </div>
      <div className="cf-gauge-amount-row">
        <span className="cf-gauge-actual">{formatYen(actualYen)}</span>
        <span className="cf-gauge-sep">/</span>
        <span className="cf-gauge-target">{hasTarget ? formatYen(targetAnnualYen) : '—'}</span>
      </div>
      <div className="cf-gauge-track" aria-hidden>
        <div
          className={`cf-gauge-fill ${over ? 'cf-gauge-fill--over' : ''} ${!hasTarget ? 'cf-gauge-fill--empty' : ''}`}
          style={{ width: hasTarget ? `${barWidthPct}%` : '0%' }}
        />
      </div>
      <div className="cf-gauge-foot">
        {hasTarget ? (
          <>
            <span className={over ? 'cf-gauge-pct cf-gauge-pct--over' : 'cf-gauge-pct'}>
              {over ? `達成 ${pctDisplay}％` : `達成率 ${pctDisplay}％`}
            </span>
            <span className="muted">月あたり目安 {formatYen(monthlyFromAnnual(targetAnnualYen))}</span>
          </>
        ) : (
          <span className="muted">年次目標を入力して保存するとゲージが表示されます</span>
        )}
      </div>
    </div>
  )
}

type Props = {
  users: User[]
  invoices: Invoice[]
  targets: Record<string, InvoiceAnnualRevenueTargetBundle>
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
  companySettings: CompanySettings
}

export function InvoiceRevenueTargetSidebar({
  users,
  invoices,
  targets,
  setState,
  showToast,
  companySettings,
}: Props) {
  const todayYm = todayIsoDate().slice(0, 7)
  const fiscalSm = companySettings.fiscalYearStartMonth
  const defaultFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)

  const [targetFy, setTargetFy] = useState(defaultFy)
  const [userInputs, setUserInputs] = useState<Record<string, string>>({})

  useInvoiceTargetFyAutoSync({
    fiscalYearStartMonth: fiscalSm,
    setTargetFy,
  })

  useEffect(() => {
    setTargetFy(fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), fiscalSm))
  }, [fiscalSm])

  const fyKey = String(targetFy)
  const bundle = targets[fyKey]

  const companyTotalFromInputs = useMemo(
    () => users.reduce((s, u) => s + parseYenInput(userInputs[u.id] ?? ''), 0),
    [users, userInputs],
  )

  const fyOptions = useMemo(() => {
    const fromData = uniqueSortedFiscalYearsDesc(invoices, fiscalSm)
    const set = new Set(fromData)
    set.add(defaultFy)
    set.add(targetFy)
    return [...set].sort((a, b) => b - a)
  }, [invoices, fiscalSm, defaultFy, targetFy])

  useEffect(() => {
    const b = targets[String(targetFy)]
    const next: Record<string, string> = {}
    for (const u of users) {
      const v = b?.userAnnualYenById[u.id]
      next[u.id] = v && v > 0 ? String(v) : ''
    }
    setUserInputs(next)
  }, [targetFy, targets, users])

  const invoicesInFy = useMemo(
    () => filterInvoicesByFiscalYear(invoices, targetFy, fiscalSm),
    [invoices, targetFy, fiscalSm],
  )

  const actualCompany = teamInvoiceTotalYen(invoicesInFy)
  const actualByUser = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of invoicesInFy) {
      m.set(inv.userId, (m.get(inv.userId) ?? 0) + inv.amountYen)
    }
    return m
  }, [invoicesInFy])

  const savedUserTarget = (uid: string) => bundle?.userAnnualYenById[uid] ?? 0

  const saveTargets = useCallback(() => {
    const userAnnualYenById: Record<string, number> = {}
    for (const u of users) {
      userAnnualYenById[u.id] = parseYenInput(userInputs[u.id] ?? '')
    }
    const companyAnnualYen = Object.values(userAnnualYenById).reduce((a, b) => a + b, 0)
    const allZero = companyAnnualYen === 0
    setState((prev) => {
      const nextMap = { ...prev.invoiceAnnualRevenueTargets }
      if (allZero) {
        delete nextMap[fyKey]
      } else {
        nextMap[fyKey] = { companyAnnualYen, userAnnualYenById }
      }
      return { ...prev, invoiceAnnualRevenueTargets: nextMap }
    })
    showToast(allZero ? 'この年度の目標をクリアしました' : '売上目標を保存しました')
  }, [userInputs, users, setState, showToast, fyKey])

  return (
    <aside className="invoices-target-sidebar panel" aria-label="売上データ（請求ベース）の年次売上目標">
      <h2 className="targets-heading">年次売上目標</h2>
      <p className="hint small">
        <strong>会計年度（設定の開始月）</strong>ごとに、各担当の<strong>年間請求目標（円）</strong>を入力します。
        <strong>会社全体の目標は、全担当の合計に自動反映</strong>されます。月次の目安は<strong>年次÷12</strong>です。下のゲージの実績は<strong>全員の請求</strong>をその年度で集計しています（データ表示の絞り込みは影響しません）。
        対象年度が暦の<strong>今期</strong>のときは、年度が切り替わると自動で合わせます（過去年度を選んでいる場合はそのままです）。
      </p>

      <label className="field">
        <span className="field-label">対象年度</span>
        <select
          className="cell-input"
          value={targetFy}
          onChange={(e) => setTargetFy(Number(e.target.value))}
        >
          {fyOptions.map((fy) => (
            <option key={fy} value={fy}>
            {fiscalYearLabel(fy, fiscalSm)}
            </option>
          ))}
        </select>
      </label>

      <div className="invoice-target-form">
        <div className="invoice-target-company-summary">
          <span className="field-label">会社全体（自動・各担当の合計）</span>
          <p className="invoice-target-company-total">{formatYen(companyTotalFromInputs)}</p>
          <p className="hint small invoice-target-monthly-hint">
            月あたり目安: <strong>{formatYen(monthlyFromAnnual(companyTotalFromInputs))}</strong>
          </p>
        </div>

        <p className="field-label" style={{ marginTop: '0.75rem' }}>
          各担当・年次目標（円）
        </p>
        <div className="invoice-target-user-fields">
          {users.map((u) => (
            <label key={u.id} className="field">
              <span className="field-label">{u.name}</span>
              <input
                type="text"
                inputMode="numeric"
                className="cell-input"
                placeholder="0"
                value={userInputs[u.id] ?? ''}
                onChange={(e) =>
                  setUserInputs((prev) => ({ ...prev, [u.id]: e.target.value }))
                }
              />
              <span className="hint small invoice-target-monthly-hint">
                月あたり目安: {formatYen(monthlyFromAnnual(parseYenInput(userInputs[u.id] ?? '')))}
              </span>
            </label>
          ))}
        </div>

        <button type="button" className="btn primary invoice-target-save" onClick={saveTargets}>
          目標を保存
        </button>
      </div>

      <div className="invoice-target-gauges" role="region" aria-label="達成ゲージ">
        <h3 className="invoice-target-gauges-heading">進捗（{fiscalYearLabel(targetFy, fiscalSm)}）</h3>
        <CrowdfundGauge
          title="会社全体"
          subtitle="各担当の合計"
          actualYen={actualCompany}
          targetAnnualYen={companyTotalFromInputs}
        />
        {users.map((u) => (
          <CrowdfundGauge
            key={u.id}
            title={u.name}
            subtitle="担当"
            actualYen={actualByUser.get(u.id) ?? 0}
            targetAnnualYen={savedUserTarget(u.id)}
          />
        ))}
      </div>
    </aside>
  )
}
