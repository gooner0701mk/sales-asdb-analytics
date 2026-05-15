import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  fiscalTermNumberForStartYear,
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'
import { todayIsoDate } from './dates'
import { createId } from './createId'
import type {
  ActivityType,
  AppState,
  CompanySettings,
  SelectOptionItem,
  User,
} from './types'
import {
  ACTIVITY_TYPE_LABEL,
  ACTIVITY_TYPES_ORDER,
  DEFAULT_COMPANY_SETTINGS,
  LEAD_SOURCE_LABEL,
  LEAD_SOURCES,
  activityTypeDisplayLabel,
} from './types'

const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

function isBuiltinLeadId(id: string): boolean {
  return (LEAD_SOURCES as readonly string[]).includes(id)
}

function slugLeadId(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return t.slice(0, 48) || `ls-${createId().slice(0, 10)}`
}

type Props = {
  users: User[]
  companySettings: CompanySettings
  leadSourceCatalog: SelectOptionItem[]
  activityTypeLabels: Partial<Record<ActivityType, string>>
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
}

export function SettingsTab({
  users,
  companySettings,
  leadSourceCatalog,
  activityTypeLabels,
  setState,
  showToast,
}: Props) {
  const [draftCompany, setDraftCompany] = useState(companySettings)
  const [userNameDraft, setUserNameDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.name])),
  )
  const [leadDraft, setLeadDraft] = useState<SelectOptionItem[]>(leadSourceCatalog)
  const [typeLabelsDraft, setTypeLabelsDraft] =
    useState<Partial<Record<ActivityType, string>>>(activityTypeLabels)

  useEffect(() => {
    setDraftCompany(companySettings)
  }, [companySettings])

  useEffect(() => {
    setUserNameDraft((prev) => {
      const next = { ...prev }
      for (const u of users) {
        if (next[u.id] === undefined) next[u.id] = u.name
      }
      for (const id of Object.keys(next)) {
        if (!users.some((u) => u.id === id)) delete next[id]
      }
      return next
    })
  }, [users])

  useEffect(() => {
    setLeadDraft(leadSourceCatalog)
  }, [leadSourceCatalog])

  useEffect(() => {
    setTypeLabelsDraft(activityTypeLabels)
  }, [activityTypeLabels])

  const previewFy = fyStartYearFromCalendarYm(todayIsoDate().slice(0, 7), draftCompany.fiscalYearStartMonth)
  const previewTerm = fiscalTermNumberForStartYear(
    previewFy,
    draftCompany.anchorFiscalYearStartYear,
    draftCompany.anchorFiscalTermNumber,
  )

  const saveCompany = useCallback(() => {
    const sm = Math.max(1, Math.min(12, Math.round(draftCompany.fiscalYearStartMonth)))
    const anchorY = Math.round(draftCompany.anchorFiscalYearStartYear)
    const anchorT = Math.max(1, Math.round(draftCompany.anchorFiscalTermNumber))
    setState((prev) => ({
      ...prev,
      companySettings: {
        companyName: draftCompany.companyName.trim(),
        fiscalYearStartMonth: sm,
        anchorFiscalYearStartYear: Number.isFinite(anchorY) ? anchorY : DEFAULT_COMPANY_SETTINGS.anchorFiscalYearStartYear,
        anchorFiscalTermNumber: Number.isFinite(anchorT) ? anchorT : 1,
      },
    }))
    showToast('会社設定を保存しました')
  }, [draftCompany, setState, showToast])

  const saveUserNames = useCallback(() => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => ({
        ...u,
        name: (userNameDraft[u.id] ?? u.name).trim() || '無名',
      })),
    }))
    showToast('ユーザー名を更新しました')
  }, [userNameDraft, setState, showToast])

  const saveLeadCatalog = useCallback(() => {
    const byDraft = new Map<string, SelectOptionItem>()
    for (const row of leadDraft) {
      const id = isBuiltinLeadId(row.id) ? row.id : slugLeadId(row.id)
      const label = row.label.trim() || id
      if (!id) continue
      if (!byDraft.has(id)) byDraft.set(id, { id, label })
    }
    const head: SelectOptionItem[] = LEAD_SOURCES.map((bid) => {
      const hit = byDraft.get(bid)
      return hit ?? { id: bid, label: LEAD_SOURCE_LABEL[bid] }
    })
    const tail: SelectOptionItem[] = []
    for (const row of leadDraft) {
      const id = isBuiltinLeadId(row.id) ? row.id : slugLeadId(row.id)
      const label = row.label.trim() || id
      if (!id || isBuiltinLeadId(id)) continue
      if (!tail.some((t) => t.id === id)) tail.push({ id, label })
    }
    const nextCatalog = [...head, ...tail]
    const idSet = new Set(nextCatalog.map((c) => c.id))
    setState((prev) => ({
      ...prev,
      leadSourceCatalog: nextCatalog,
      activities: prev.activities.map((a) => ({
        ...a,
        leadSource:
          a.leadSource != null && idSet.has(a.leadSource) ? a.leadSource : null,
      })),
    }))
    showToast('流入経路を保存しました')
  }, [leadDraft, setState, showToast])

  const saveActivityTypeLabels = useCallback(() => {
    const next: Partial<Record<ActivityType, string>> = {}
    for (const t of ACTIVITY_TYPES_ORDER) {
      const v = typeLabelsDraft[t]?.trim()
      if (v) next[t] = v
    }
    setState((prev) => ({ ...prev, activityTypeLabels: next }))
    showToast('営業種類の表示名を保存しました')
  }, [typeLabelsDraft, setState, showToast])

  const addLeadRow = useCallback(() => {
    setLeadDraft((d) => [
      ...d,
      { id: `ls-${createId().replace(/-/g, '').slice(0, 10)}`, label: '新しい流入経路' },
    ])
  }, [])

  const removeLeadRow = useCallback((id: string) => {
    if (isBuiltinLeadId(id)) {
      showToast('既定の流入経路は削除できません（表示名の変更は可能です）')
      return
    }
    setLeadDraft((d) => d.filter((r) => r.id !== id))
  }, [showToast])

  return (
    <div className="targets-tab settings-tab">
      <section className="panel">
        <h2 className="targets-heading">会社設定</h2>
        <p className="hint small">
          会計年度の開始月と「第何期」の基準を決めると、分析タブの<strong>年次</strong>表示や売上タブの年度ラベルに反映されます（過去の年度も選択して振り返れます）。
        </p>

        <label className="field">
          <span className="field-label">会社名（表示用）</span>
          <input
            type="text"
            className="cell-input grow"
            value={draftCompany.companyName}
            onChange={(e) =>
              setDraftCompany((d) => ({ ...d, companyName: e.target.value }))
            }
            placeholder="例：株式会社〇〇"
          />
        </label>

        <label className="field">
          <span className="field-label">会計年度の開始月</span>
          <select
            className="cell-input"
            value={draftCompany.fiscalYearStartMonth}
            onChange={(e) =>
              setDraftCompany((d) => ({
                ...d,
                fiscalYearStartMonth: Number(e.target.value),
              }))
            }
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}始まり
              </option>
            ))}
          </select>
        </label>

        <div className="settings-term-grid">
          <label className="field">
            <span className="field-label">期番号の基準となる年度（開始年）</span>
            <input
              type="number"
              className="cell-input"
              min={1900}
              max={2100}
              step={1}
              value={draftCompany.anchorFiscalYearStartYear}
              onChange={(e) =>
                setDraftCompany((d) => ({
                  ...d,
                  anchorFiscalYearStartYear: Number(e.target.value),
                }))
              }
            />
            <span className="hint small">例: 2024（その年の会計年度開始を意味します）</span>
          </label>
          <label className="field">
            <span className="field-label">上記の年度は第何期か</span>
            <input
              type="number"
              className="cell-input"
              min={1}
              max={999}
              step={1}
              value={draftCompany.anchorFiscalTermNumber}
              onChange={(e) =>
                setDraftCompany((d) => ({
                  ...d,
                  anchorFiscalTermNumber: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>

        <p className="hint small settings-preview">
          プレビュー（今日の暦に基づく今期）:{' '}
          <strong>
            {fiscalYearRangeLabel(previewFy, draftCompany.fiscalYearStartMonth)}（第
            {previewTerm}期）
          </strong>
        </p>

        <button type="button" className="btn primary" onClick={saveCompany}>
          会社設定を保存
        </button>
      </section>

      <section className="panel settings-catalog-panel">
        <h2 className="targets-heading">活動記録の選択肢</h2>
        <p className="hint small">
          <strong>流入経路</strong>は追加・削除・表示名の変更ができます（CSV の leadSource 列は id と一致させます）。<strong>営業種類</strong>は集計の都合上4種類固定で、<strong>表示名のみ</strong>変更できます（内部キー coldVisit 等は変わりません）。
        </p>

        <h3 className="settings-subheading">流入経路</h3>
        <table className="targets-table settings-catalog-table">
          <thead>
            <tr>
              <th>ID（CSV・内部用）</th>
              <th>表示名</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leadDraft.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-mono"
                    value={row.id}
                    disabled={isBuiltinLeadId(row.id)}
                    onChange={(e) => {
                      const v = e.target.value
                      setLeadDraft((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, id: v } : r)),
                      )
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-wide"
                    value={row.label}
                    onChange={(e) => {
                      const v = e.target.value
                      setLeadDraft((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, label: v } : r)),
                      )
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost danger"
                    disabled={isBuiltinLeadId(row.id)}
                    onClick={() => removeLeadRow(row.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="settings-catalog-actions">
          <button type="button" className="btn ghost" onClick={addLeadRow}>
            行を追加
          </button>
          <button type="button" className="btn primary" onClick={saveLeadCatalog}>
            流入経路を保存
          </button>
        </div>

        <h3 className="settings-subheading">営業種類の表示名</h3>
        <table className="targets-table settings-catalog-table">
          <thead>
            <tr>
              <th>内部キー</th>
              <th>表示名</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_TYPES_ORDER.map((t) => (
              <tr key={t}>
                <td className="settings-mono-cell">{t}</td>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-wide"
                    placeholder={ACTIVITY_TYPE_LABEL[t]}
                    value={typeLabelsDraft[t] ?? ''}
                    onChange={(e) =>
                      setTypeLabelsDraft((prev) => ({
                        ...prev,
                        [t]: e.target.value,
                      }))
                    }
                  />
                  <span className="hint small">
                    既定: {ACTIVITY_TYPE_LABEL[t]}
                    {activityTypeDisplayLabel(typeLabelsDraft, t) !== ACTIVITY_TYPE_LABEL[t]
                      ? ` → 現在の表示: ${activityTypeDisplayLabel(typeLabelsDraft, t)}`
                      : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="settings-catalog-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setTypeLabelsDraft({})}
          >
            表示名をすべて既定に戻す（保存は別）
          </button>
          <button type="button" className="btn primary" onClick={saveActivityTypeLabels}>
            営業種類の表示名を保存
          </button>
        </div>
      </section>

      <section className="panel settings-users-panel">
        <h2 className="targets-heading">ユーザー設定</h2>
        <p className="hint small">
          表示名の変更はここで行います。ユーザーの<strong>追加・削除</strong>は「分析・活動記録」タブ上部から行えます。
        </p>
        <table className="targets-table settings-user-table">
          <thead>
            <tr>
              <th>表示名</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-wide"
                    value={userNameDraft[u.id] ?? u.name}
                    onChange={(e) =>
                      setUserNameDraft((prev) => ({
                        ...prev,
                        [u.id]: e.target.value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn primary" onClick={saveUserNames}>
          ユーザー名を保存
        </button>
      </section>
    </div>
  )
}
