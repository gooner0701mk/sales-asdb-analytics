import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  fiscalTermNumberForStartYear,
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'
import { todayIsoDate } from './dates'
import type { AppState, CompanySettings, User } from './types'
import { DEFAULT_COMPANY_SETTINGS } from './types'

const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

type Props = {
  users: User[]
  companySettings: CompanySettings
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
}

export function SettingsTab({
  users,
  companySettings,
  setState,
  showToast,
}: Props) {
  const [draftCompany, setDraftCompany] = useState(companySettings)
  const [userNameDraft, setUserNameDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.name])),
  )

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
