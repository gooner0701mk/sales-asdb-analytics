import {
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { sortTargetsByElapsedDesc, syncApproachTargetsFromActivities } from './approachTargets'
import { inferLeadSourceForCompany } from './companyMetrics'
import { daysElapsedSince, formatDateJa, formatElapsedLabel, todayIsoDate } from './dates'
import { DataViewUserSelectBar } from './DataViewUserSelectBar'
import { dataViewShowsOwnerColumn } from './dataViewSelection'
import type { ActivityLog, ApproachTarget, AppState, DataViewUserIds, User } from './types'
import { LEAD_SOURCE_LABEL, newApproachTarget } from './types'

type Props = {
  targets: ApproachTarget[]
  users: User[]
  sessionUserId: string | null
  dataViewUserIds: DataViewUserIds
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
  activities: ActivityLog[]
}

export function TargetsTab({
  targets,
  users,
  sessionUserId,
  dataViewUserIds,
  setState,
  showToast,
  activities,
}: Props) {
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState<string>('')

  const visible = useMemo(() => {
    const base =
      dataViewUserIds === 'all'
        ? targets
        : targets.filter((t) => dataViewUserIds.includes(t.ownerUserId))
    return sortTargetsByElapsedDesc(base)
  }, [targets, dataViewUserIds])

  const showOwnerCol = dataViewShowsOwnerColumn(dataViewUserIds)

  const addTarget = (e: FormEvent) => {
    e.preventDefault()
    if (!sessionUserId) {
      showToast('先にユーザーを選択してください（分析タブ）')
      return
    }
    const name = formName.trim()
    if (!name) {
      showToast('企業名を入力してください')
      return
    }
    const row = newApproachTarget(
      name,
      sessionUserId,
      formDate || null,
    )
    setState((prev) => ({
      ...prev,
      approachTargets: syncApproachTargetsFromActivities(
        [...prev.approachTargets, row],
        prev.activities,
      ),
    }))
    setFormName('')
    setFormDate('')
    showToast('企業を追加しました')
  }

  const updateTarget = (id: string, patch: Partial<ApproachTarget>) => {
    setState((prev) => ({
      ...prev,
      approachTargets: prev.approachTargets.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }))
  }

  const removeTarget = (id: string) => {
    setState((prev) => ({
      ...prev,
      approachTargets: prev.approachTargets.filter((t) => t.id !== id),
    }))
    showToast('削除しました')
  }

  const setApproachToday = (id: string) => {
    updateTarget(id, { lastApproachDate: todayIsoDate() })
    showToast('前回アプローチ日を今日に更新しました')
  }

  return (
    <div className="targets-tab">
      <DataViewUserSelectBar
        users={users}
        dataViewUserIds={dataViewUserIds}
        setState={setState}
      />
      <section className="panel">
        <h2 className="targets-heading">アプローチ先企業一覧</h2>
        <p className="hint">
          <strong>活動を記録した直後</strong>から、担当と企業名が一致する行がここに反映されます（商談・接待でも<strong>企業行は追加</strong>）。
          企業名は<strong>全角半角・不可視文字・法人格表記</strong>などのゆれもできるだけ同一視します。
          一覧の担当と活動の記録者が違っても、同一企業なら<strong>他担当の活動</strong>から日付を拾います（CSVで userId が一括のときなど）。
          欄「前回アプローチ日」には<strong>いずれかの活動種別のうち最新の活動日</strong>が入り、手入力より<strong>日付が新しい方</strong>が採用されます。
          <strong>流入経路</strong>は活動ログから自動表示します（担当の活動を優先し、同一企業の<strong>新しい活動から見て最初に流入経路が記録されている値</strong>。未記録なら「―」）。
          <strong>経過日数</strong>はその日付から自動計算されるため、新しいアプローチ活動を入れると一覧の経過も更新されます。
          活動ログに企業が残っていると、一覧から削除しても同期で再び追加されることがあります。
          表示範囲は<strong>上のプルダウン</strong>で切り替えられます（分析タブの表示範囲とも同期します）。
        </p>

        <form className="targets-add-form" onSubmit={addTarget}>
          <label className="field inline">
            <span className="field-label">企業名</span>
            <input
              type="text"
              className="cell-input grow"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="例：株式会社〇〇"
            />
          </label>
          <label className="field inline">
            <span className="field-label">前回アプローチ日</span>
            <input
              type="date"
              className="cell-input"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary">
            追加
          </button>
        </form>
      </section>

      <section className="panel targets-table-panel">
        <div className="table-scroll">
          <table className="data-table targets-table">
            <thead>
              <tr>
                <th>企業名</th>
                <th>流入経路（ログ）</th>
                {showOwnerCol && <th>担当</th>}
                <th>前回アプローチ日</th>
                <th>経過</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={showOwnerCol ? 6 : 5} className="targets-empty">
                    {targets.length === 0
                      ? '企業がまだありません。分析タブで活動を記録すると自動で現れます（日付は直近の活動日から）。上のフォームから手動追加もできます。'
                      : dataViewUserIds !== 'all'
                        ? '選択中の担当に紐づく企業がまだありません。プルダウンで表示するユーザーを変更してください。'
                        : '表示できる企業がありません。'}
                  </td>
                </tr>
              ) : (
                visible.map((t) => {
                  const elapsed = daysElapsedSince(t.lastApproachDate)
                  const lead = inferLeadSourceForCompany(
                    activities,
                    t.ownerUserId,
                    t.companyName,
                  )
                  return (
                    <tr key={t.id}>
                      <td>
                        <input
                          type="text"
                          className="cell-input table-cell-wide"
                          value={t.companyName}
                          onChange={(e) =>
                            updateTarget(t.id, { companyName: e.target.value })
                          }
                        />
                      </td>
                      <td className="targets-lead-cell">
                        {lead ? (
                          <span className="targets-lead-label">{LEAD_SOURCE_LABEL[lead]}</span>
                        ) : (
                          <span className="muted">―</span>
                        )}
                      </td>
                      {showOwnerCol && (
                        <td>
                          <select
                            className="cell-input"
                            value={t.ownerUserId}
                            onChange={(e) =>
                              updateTarget(t.id, { ownerUserId: e.target.value })
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
                          type="date"
                          className="cell-input"
                          value={t.lastApproachDate ?? ''}
                          onChange={(e) =>
                            updateTarget(t.id, {
                              lastApproachDate: e.target.value || null,
                            })
                          }
                        />
                        <span className="ym-sub">
                          {formatDateJa(t.lastApproachDate)}
                        </span>
                      </td>
                      <td className="targets-elapsed">
                        {elapsed === null ? (
                          <span className="muted">―</span>
                        ) : (
                          <span
                            className={
                              elapsed > 30 ? 'targets-elapsed-warn' : undefined
                            }
                            title={`数値: ${elapsed} 日`}
                          >
                            {formatElapsedLabel(elapsed)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="targets-actions">
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => setApproachToday(t.id)}
                          >
                            今日
                          </button>
                          <button
                            type="button"
                            className="btn icon danger"
                            onClick={() => removeTarget(t.id)}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="hint small targets-sort-note">
          並び順：経過日数が大きい（久しぶり）順。日付未設定は末尾です。
        </p>
      </section>
    </div>
  )
}
