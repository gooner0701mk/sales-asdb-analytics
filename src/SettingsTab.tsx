import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  fiscalTermNumberForStartYear,
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'
import { attendanceLabels as attendanceT } from './attendance/labels'
import { hashAttendancePassword, verifyAttendancePassword } from './attendance/password'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { todayIsoDate } from './dates'
import { createId } from './createId'
import {
  includeUserInSalesAnalytics,
  newAttendanceOnlyUser,
  usersForSalesAnalytics,
} from './userRoles'
import type {
  ActivityAnalysisRole,
  ActivityTypeCatalogItem,
  AppState,
  CompanySettings,
  SelectOptionItem,
  User,
} from './types'
import {
  ACTIVITY_TYPE_LABEL,
  BUILTIN_ACTIVITY_IDS,
  DEFAULT_COMPANY_SETTINGS,
  LEAD_SOURCE_LABEL,
  LEAD_SOURCES,
  defaultActivityTypeCatalog,
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

function isBuiltinActivityId(id: string): boolean {
  return (BUILTIN_ACTIVITY_IDS as readonly string[]).includes(id)
}

function slugActivityTypeId(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return t.slice(0, 48) || `at-${createId().replace(/-/g, '').slice(0, 10)}`
}

const ROLE_OPTION_LABEL: Record<ActivityAnalysisRole, string> = {
  approach: 'アプローチ（転換率の母集団）',
  meeting: '商談（転換率・商談件数）',
  reception: '接待',
  general: 'その他（件数のみ）',
}

type Props = {
  users: User[]
  companySettings: CompanySettings
  leadSourceCatalog: SelectOptionItem[]
  activityTypeCatalog: ActivityTypeCatalogItem[]
  attendanceAdminUserIds: string[]
  attendanceCorrectionPasswordHash: string
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
  onResetSample: () => void
  onClearAll: () => void
}

export function SettingsTab({
  users,
  companySettings,
  leadSourceCatalog,
  activityTypeCatalog,
  attendanceAdminUserIds,
  attendanceCorrectionPasswordHash,
  setState,
  showToast,
  onResetSample,
  onClearAll,
}: Props) {
  const [draftCompany, setDraftCompany] = useState(companySettings)
  const [userNameDraft, setUserNameDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.name])),
  )
  const [salesIncludeDraft, setSalesIncludeDraft] = useState<Record<string, boolean>>(
    () => Object.fromEntries(users.map((u) => [u.id, includeUserInSalesAnalytics(u)])),
  )
  const [attendanceOnlyName, setAttendanceOnlyName] = useState('')
  const [leadDraft, setLeadDraft] = useState<SelectOptionItem[]>(leadSourceCatalog)
  const [activityDraft, setActivityDraft] = useState<ActivityTypeCatalogItem[]>(
    () => activityTypeCatalog.map((x) => ({ ...x })),
  )
  const [attendanceAdminDraft, setAttendanceAdminDraft] = useState<string[]>(
    () => [...attendanceAdminUserIds],
  )
  const [correctionPw, setCorrectionPw] = useState('')
  const [correctionPwConfirm, setCorrectionPwConfirm] = useState('')
  const [maintenancePw, setMaintenancePw] = useState('')
  const [maintenanceUnlocked, setMaintenanceUnlocked] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'sample' | 'clear' | null>(
    null,
  )

  useEffect(() => {
    setActivityDraft(activityTypeCatalog.map((x) => ({ ...x })))
  }, [activityTypeCatalog])

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
    setSalesIncludeDraft((prev) => {
      const next = { ...prev }
      for (const u of users) {
        if (next[u.id] === undefined) next[u.id] = includeUserInSalesAnalytics(u)
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
    setAttendanceAdminDraft([...attendanceAdminUserIds])
  }, [attendanceAdminUserIds])

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

  const addAttendanceOnlyUser = useCallback(() => {
    const name = attendanceOnlyName.trim()
    if (!name) {
      showToast('表示名を入力してください')
      return
    }
    const u = newAttendanceOnlyUser(name)
    setState((prev) => ({
      ...prev,
      users: [...prev.users, u],
    }))
    setAttendanceOnlyName('')
    showToast(`勤怠専用ユーザーを追加しました：${u.name}`)
  }, [attendanceOnlyName, setState, showToast])

  const saveUserSettings = useCallback(() => {
    setState((prev) => {
      const nextUsers = prev.users.map((u) => {
        const include = salesIncludeDraft[u.id] !== false
        return {
          ...u,
          name: (userNameDraft[u.id] ?? u.name).trim() || '無名',
          includeInSalesAnalytics: include ? true : false,
        }
      })
      const salesIds = new Set(usersForSalesAnalytics(nextUsers).map((x) => x.id))
      let nextDataView = prev.dataViewUserIds
      if (nextDataView !== 'all') {
        const filtered = nextDataView.filter((id) => salesIds.has(id))
        if (filtered.length === 0) nextDataView = 'all'
        else if (filtered.length >= salesIds.size) nextDataView = 'all'
        else nextDataView = filtered
      }
      return {
        ...prev,
        users: nextUsers,
        dataViewUserIds: nextDataView,
      }
    })
    showToast('ユーザー設定を保存しました')
  }, [userNameDraft, salesIncludeDraft, setState, showToast])

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

  const saveActivityCatalog = useCallback(() => {
    const defaults = defaultActivityTypeCatalog()
    const draftBuiltin = new Map(
      activityDraft
        .filter((r) => isBuiltinActivityId(r.id))
        .map((r) => [r.id, r]),
    )
    const head: ActivityTypeCatalogItem[] = defaults.map((d) => {
      const hit = draftBuiltin.get(d.id)
      const label = (hit?.label ?? d.label).trim() || d.label
      return { id: d.id, label, role: d.role }
    })
    const used = new Set(head.map((h) => h.id))
    const tail: ActivityTypeCatalogItem[] = []
    for (const row of activityDraft) {
      if (isBuiltinActivityId(row.id)) continue
      let id = row.id.trim() ? slugActivityTypeId(row.id) : ''
      if (!id) id = slugActivityTypeId(row.label || 'type')
      if (!id) id = `at-${createId().replace(/-/g, '').slice(0, 8)}`
      while (used.has(id)) {
        id = `at-${createId().replace(/-/g, '').slice(0, 8)}`
      }
      used.add(id)
      const label = row.label.trim() || id
      let role: ActivityAnalysisRole = 'general'
      if (
        row.role === 'approach' ||
        row.role === 'meeting' ||
        row.role === 'reception' ||
        row.role === 'general'
      ) {
        role = row.role
      }
      tail.push({ id, label, role })
    }
    const nextCatalog = [...head, ...tail]
    const idSet = new Set(nextCatalog.map((x) => x.id))
    const fallback =
      nextCatalog.find((x) => x.id === 'teleAppo')?.id ??
      nextCatalog[0]?.id ??
      'teleAppo'
    setState((prev) => ({
      ...prev,
      activityTypeCatalog: nextCatalog,
      activities: prev.activities.map((a) => ({
        ...a,
        activityType: idSet.has(a.activityType) ? a.activityType : fallback,
      })),
    }))
    showToast('営業種類を保存しました')
  }, [activityDraft, setState, showToast])

  const addActivityTypeRow = useCallback(() => {
    setActivityDraft((d) => [
      ...d,
      { id: '', label: '新しい営業種類', role: 'general' },
    ])
  }, [])

  const removeActivityTypeRowAt = useCallback(
    (idx: number) => {
      const row = activityDraft[idx]
      if (!row) return
      if (isBuiltinActivityId(row.id)) {
        showToast(
          '既定の営業種類は削除できません（表示名の変更や行の追加は可能です）',
        )
        return
      }
      setActivityDraft((d) => d.filter((_, i) => i !== idx))
    },
    [activityDraft, showToast],
  )

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

        <h3 className="settings-subheading">営業種類</h3>
        <p className="hint small">
          既定の4種は削除できません（分析用の役割も固定です）。行を追加すると<strong>種類そのもの</strong>が増え、フォーム・グラフ・CSVに反映されます。内部キーは英数字推奨（保存時に正規化されます）。カタログに無いキーの活動は、保存時にテレアポ（または先頭の種類）へ置き換わります。
        </p>
        <table className="targets-table settings-catalog-table">
          <thead>
            <tr>
              <th>内部キー</th>
              <th>表示名</th>
              <th>分析上の役割</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activityDraft.map((row, idx) => (
              <tr key={`${row.id || 'new'}-${idx}`}>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-mono"
                    value={row.id}
                    disabled={isBuiltinActivityId(row.id)}
                    placeholder="保存時に自動生成（空欄時）"
                    onChange={(e) => {
                      const v = e.target.value
                      setActivityDraft((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, id: v } : r)),
                      )
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="cell-input table-cell-wide"
                    placeholder={
                      isBuiltinActivityId(row.id)
                        ? (ACTIVITY_TYPE_LABEL as Record<string, string>)[row.id]
                        : '表示名'
                    }
                    value={row.label}
                    onChange={(e) => {
                      const v = e.target.value
                      setActivityDraft((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, label: v } : r)),
                      )
                    }}
                  />
                </td>
                <td>
                  {isBuiltinActivityId(row.id) ? (
                    <span className="hint small" style={{ whiteSpace: 'normal' }}>
                      {ROLE_OPTION_LABEL[row.role]}（既定）
                    </span>
                  ) : (
                    <select
                      className="cell-input"
                      value={row.role}
                      onChange={(e) => {
                        const v = e.target.value as ActivityAnalysisRole
                        setActivityDraft((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, role: v } : r,
                          ),
                        )
                      }}
                    >
                      {(Object.keys(ROLE_OPTION_LABEL) as ActivityAnalysisRole[]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {ROLE_OPTION_LABEL[k]}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost danger"
                    disabled={isBuiltinActivityId(row.id)}
                    onClick={() => removeActivityTypeRowAt(idx)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="settings-catalog-actions">
          <button type="button" className="btn ghost" onClick={addActivityTypeRow}>
            行を追加
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              setActivityDraft(activityTypeCatalog.map((x) => ({ ...x })))
            }
          >
            変更を取り消し
          </button>
          <button type="button" className="btn primary" onClick={saveActivityCatalog}>
            営業種類を保存
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="targets-heading">勤怠の管理者</h2>
        <p className="hint small">
          チェックした担当者は、勤怠タブで<strong>残業の承認・却下</strong>ができます（複数指定可）。未指定のときは誰も承認できません。
        </p>
        <ul className="settings-attendance-admin-list">
          {users.map((u) => (
            <li key={u.id}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={attendanceAdminDraft.includes(u.id)}
                  onChange={(e) => {
                    setAttendanceAdminDraft((prev) =>
                      e.target.checked
                        ? [...prev, u.id]
                        : prev.filter((id) => id !== u.id),
                    )
                  }}
                />
                {u.name}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const idSet = new Set(users.map((u) => u.id))
            const next = attendanceAdminDraft.filter((id) => idSet.has(id))
            setState((prev) => ({ ...prev, attendanceAdminUserIds: next }))
            showToast('勤怠管理者を保存しました')
          }}
        >
          勤怠管理者を保存
        </button>
      </section>

      <section className="panel">
        <h2 className="targets-heading">{attendanceT.settingsCorrectionPassword}</h2>
        <p className="hint small">{attendanceT.settingsCorrectionPasswordHint}</p>
        <p className="hint small">{attendanceT.samplePasswordNote}</p>
        {attendanceCorrectionPasswordHash ? (
          <p className="hint small">現在、打刻修正用パスワードは設定済みです（表示はされません）。</p>
        ) : null}
        <label className="field">
          <span className="field-label">{attendanceT.settingsCorrectionPassword}</span>
          <input
            type="password"
            className="cell-input"
            value={correctionPw}
            onChange={(e) => setCorrectionPw(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span className="field-label">{attendanceT.settingsCorrectionPasswordConfirm}</span>
          <input
            type="password"
            className="cell-input"
            value={correctionPwConfirm}
            onChange={(e) => setCorrectionPwConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            void (async () => {
              const a = correctionPw.trim()
              const b = correctionPwConfirm.trim()
              if (!a) {
                showToast(attendanceT.correctionNoPassword)
                return
              }
              if (a !== b) {
                showToast(attendanceT.settingsCorrectionPasswordMismatch)
                return
              }
              const hash = await hashAttendancePassword(a)
              setState((prev) => ({
                ...prev,
                attendanceCorrectionPasswordHash: hash,
              }))
              setCorrectionPw('')
              setCorrectionPwConfirm('')
              showToast(attendanceT.settingsCorrectionPasswordSaved)
            })()
          }}
        >
          {attendanceT.settingsCorrectionPasswordSave}
        </button>
      </section>

      <section className="panel settings-users-panel">
        <h2 className="targets-heading">ユーザー設定</h2>
        <p className="hint small">
          <strong>営業・売上に含める</strong>をオフにしたユーザーは勤怠・給与のみで、活動記録・請求・分析の担当一覧には出ません。
          営業担当の追加・削除は「営業 › 活動記録・分析」画面から行えます。
        </p>
        <table className="targets-table settings-user-table">
          <thead>
            <tr>
              <th>表示名</th>
              <th>営業・売上に含める</th>
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
                  {!includeUserInSalesAnalytics(u) && (
                    <span className="hint small settings-user-badge">勤怠専用</span>
                  )}
                </td>
                <td className="settings-user-check-cell">
                  <label className="settings-user-check">
                    <input
                      type="checkbox"
                      checked={salesIncludeDraft[u.id] !== false}
                      onChange={(e) =>
                        setSalesIncludeDraft((prev) => ({
                          ...prev,
                          [u.id]: e.target.checked,
                        }))
                      }
                    />
                    含める
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn primary" onClick={saveUserSettings}>
          ユーザー設定を保存
        </button>
        <div className="settings-attendance-only-add">
          <h3 className="settings-subheading">勤怠専用ユーザーを追加</h3>
          <p className="hint small">
            事務・製造など営業分析に載せたくない社員を、勤怠・給与Excel用だけに登録します。
          </p>
          <div className="user-bar-row add-user-row">
            <input
              type="text"
              className="cell-input grow"
              value={attendanceOnlyName}
              onChange={(e) => setAttendanceOnlyName(e.target.value)}
              placeholder="表示名（例：山田 太郎）"
            />
            <button type="button" className="btn" onClick={addAttendanceOnlyUser}>
              勤怠専用で追加
            </button>
          </div>
        </div>
      </section>

      <section className="panel settings-maintenance-panel">
        <h2 className="targets-heading">データの初期化（管理者）</h2>
        <p className="hint small">
          サンプル再読込・全消去は<strong>打刻修正と同じパスワード</strong>で解除できます。実行前に必ず確認ダイアログが出ます。
        </p>
        {!maintenanceUnlocked ? (
          <div className="settings-maintenance-unlock">
            <label className="field">
              <span className="field-label">パスワード</span>
              <input
                type="password"
                className="cell-input"
                value={maintenancePw}
                autoComplete="current-password"
                onChange={(e) => setMaintenancePw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void (async () => {
                      const ok = await verifyAttendancePassword(
                        maintenancePw,
                        attendanceCorrectionPasswordHash,
                      )
                      if (!ok) {
                        showToast('パスワードが違います')
                        return
                      }
                      setMaintenanceUnlocked(true)
                      setMaintenancePw('')
                      showToast('操作を解除しました')
                    })()
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void (async () => {
                  const ok = await verifyAttendancePassword(
                    maintenancePw,
                    attendanceCorrectionPasswordHash,
                  )
                  if (!ok) {
                    showToast('パスワードが違います')
                    return
                  }
                  setMaintenanceUnlocked(true)
                  setMaintenancePw('')
                  showToast('操作を解除しました')
                })()
              }}
            >
              パスワードを確認
            </button>
          </div>
        ) : (
          <p className="hint small settings-maintenance-unlocked-note">
            解除済みです（この設定画面を開いている間のみ有効）
          </p>
        )}
        <div className="settings-maintenance-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={!maintenanceUnlocked}
            onClick={() => setConfirmAction('sample')}
          >
            サンプル再読込
          </button>
          <button
            type="button"
            className="btn danger ghost"
            disabled={!maintenanceUnlocked}
            onClick={() => setConfirmAction('clear')}
          >
            全消去
          </button>
        </div>
      </section>

      <ConfirmActionDialog
        open={confirmAction === 'sample'}
        title="サンプルデータを読み込みますか？"
        message="現在のデータはサンプル内容で上書きされます。この操作は元に戻せません。"
        confirmLabel="サンプルを読み込む"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null)
          onResetSample()
        }}
      />
      <ConfirmActionDialog
        open={confirmAction === 'clear'}
        title="すべてのデータを消去しますか？"
        message="活動・請求・勤怠・設定を含む保存データがすべて削除されます。この操作は元に戻せません。"
        confirmLabel="全消去する"
        danger
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null)
          onClearAll()
        }}
      />
    </div>
  )
}
