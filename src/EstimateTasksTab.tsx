import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { calendarDayDiff, formatDateJa, todayIsoDate } from './dates'
import { DataViewUserSelectBar } from './DataViewUserSelectBar'
import { dataViewShowsOwnerColumn } from './dataViewSelection'
import {
  fiscalYearDateRangeIso,
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'
import { useMediaQuery } from './useMediaQuery'
import type {
  AppState,
  CompanySettings,
  DataViewUserIds,
  EstimateTask,
  User,
} from './types'
import { newEstimateTask } from './types'

type Props = {
  estimateTasks: EstimateTask[]
  users: User[]
  sessionUserId: string | null
  dataViewUserIds: DataViewUserIds
  setState: Dispatch<SetStateAction<AppState>>
  showToast: (msg: string) => void
  companySettings: CompanySettings
}

function projectNameToneClass(task: EstimateTask, today: string): string {
  if (task.completed) return ''
  const d = calendarDayDiff(today, task.deadline)
  if (!Number.isFinite(d)) return ''
  if (d <= 0) return 'estimate-task-project-overdue'
  if (d === 1) return 'estimate-task-project-due-1'
  if (d === 2 || d === 3) return 'estimate-task-project-due-3'
  return ''
}

/** 未完了タスクの期限までの暦日数（当日=0、超過は負）。完了は null */
function daysLeftUntilDeadline(task: EstimateTask, today: string): number | null {
  if (task.completed) return null
  const d = calendarDayDiff(today, task.deadline)
  return Number.isFinite(d) ? d : null
}

function formatRemainingLabel(d: number | null): string {
  if (d === null) return '提出済'
  if (d < 0) return `期限超過 ${-d} 日`
  if (d === 0) return '今日が期限'
  if (d === 1) return 'あと 1 日'
  return `あと ${d} 日`
}

function remainingCellClass(d: number | null): string {
  if (d === null) return 'estimate-task-remaining-done'
  if (d <= 0) return 'estimate-task-remaining-overdue'
  if (d === 1) return 'estimate-task-remaining-due1'
  if (d === 2 || d === 3) return 'estimate-task-remaining-warn'
  return ''
}

function rowUrgencyClass(task: EstimateTask, today: string): string {
  if (task.completed) return ''
  const d = calendarDayDiff(today, task.deadline)
  if (!Number.isFinite(d)) return ''
  if (d <= 0) return 'estimate-task-row-overdue'
  if (d === 1) return 'estimate-task-row-due1'
  if (d === 2 || d === 3) return 'estimate-task-row-warn'
  return ''
}

function countCompletedInMonth(tasks: EstimateTask[], ym: string): number {
  return tasks.filter(
    (t) =>
      t.completed &&
      t.completedAt != null &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.completedAt) &&
      t.completedAt.slice(0, 7) === ym,
  ).length
}

function countCompletedInFiscalYear(
  tasks: EstimateTask[],
  fyStartYear: number,
  fiscalStartMonth: number,
): number {
  const { lo, hiEx } = fiscalYearDateRangeIso(fyStartYear, fiscalStartMonth)
  return tasks.filter(
    (t) =>
      t.completed &&
      t.completedAt != null &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.completedAt) &&
      t.completedAt >= lo &&
      t.completedAt < hiEx,
  ).length
}

export function EstimateTasksTab({
  estimateTasks,
  users,
  sessionUserId,
  dataViewUserIds,
  setState,
  showToast,
  companySettings,
}: Props) {
  const today = todayIsoDate()
  const todayYm = today.slice(0, 7)
  const fiscalSm = companySettings.fiscalYearStartMonth
  const defaultFy = fyStartYearFromCalendarYm(todayYm, fiscalSm)

  const [focusYm, setFocusYm] = useState(todayYm)
  const [focusFyStartYear, setFocusFyStartYear] = useState(defaultFy)

  const [formProject, setFormProject] = useState('')
  const [formCustomer, setFormCustomer] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formAssignee, setFormAssignee] = useState(() => sessionUserId ?? '')

  useEffect(() => {
    if (sessionUserId && !users.some((u) => u.id === formAssignee)) {
      setFormAssignee(sessionUserId)
    }
  }, [sessionUserId, users, formAssignee])
  const [formDeadline, setFormDeadline] = useState(today)

  const showOwnerCol = dataViewShowsOwnerColumn(dataViewUserIds)
  const narrowLayout = useMediaQuery('(max-width: 960px)')

  const sortedVisible = useMemo(() => {
    const base =
      dataViewUserIds === 'all'
        ? estimateTasks
        : estimateTasks.filter((t) => dataViewUserIds.includes(t.assigneeUserId))
    const open = base
      .filter((t) => !t.completed)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
    const done = base
      .filter((t) => t.completed)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
    return [...open, ...done]
  }, [estimateTasks, dataViewUserIds])

  const fyYearOptions = useMemo(() => {
    const s = new Set<number>()
    s.add(defaultFy)
    s.add(defaultFy + 1)
    s.add(defaultFy - 1)
    for (const t of estimateTasks) {
      if (t.completedAt && /^\d{4}-\d{2}-\d{2}$/.test(t.completedAt)) {
        s.add(fyStartYearFromCalendarYm(t.completedAt.slice(0, 7), fiscalSm))
      }
    }
    return [...s].sort((a, b) => b - a)
  }, [estimateTasks, defaultFy, fiscalSm])

  const statsRows = useMemo(() => {
    const monthTotal = countCompletedInMonth(estimateTasks, focusYm)
    const fyTotal = countCompletedInFiscalYear(
      estimateTasks,
      focusFyStartYear,
      fiscalSm,
    )
    const perUser = users.map((u) => ({
      userId: u.id,
      name: u.name,
      month: countCompletedInMonth(
        estimateTasks.filter((t) => t.assigneeUserId === u.id),
        focusYm,
      ),
      fy: countCompletedInFiscalYear(
        estimateTasks.filter((t) => t.assigneeUserId === u.id),
        focusFyStartYear,
        fiscalSm,
      ),
    }))
    return { perUser, monthTotal, fyTotal }
  }, [estimateTasks, users, focusYm, focusFyStartYear, fiscalSm])

  const addTask = (e: FormEvent) => {
    e.preventDefault()
    const assignee = formAssignee || sessionUserId
    if (!assignee || !users.some((u) => u.id === assignee)) {
      showToast('見積もり担当者を選んでください')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDeadline)) {
      showToast('提出期限の日付が不正です')
      return
    }
    const row = newEstimateTask(
      assignee,
      formDeadline,
      formProject,
      formCustomer,
      formContact,
    )
    setState((prev) => ({
      ...prev,
      estimateTasks: [...prev.estimateTasks, row],
    }))
    setFormProject('')
    setFormCustomer('')
    setFormContact('')
    setFormDeadline(today)
    showToast('タスクを追加しました')
  }

  const patchTask = (id: string, patch: Partial<EstimateTask>) => {
    setState((prev) => ({
      ...prev,
      estimateTasks: prev.estimateTasks.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }))
  }

  const setCompleted = (id: string, completed: boolean) => {
    setState((prev) => ({
      ...prev,
      estimateTasks: prev.estimateTasks.map((t) =>
        t.id === id
          ? {
              ...t,
              completed,
              completedAt: completed ? todayIsoDate() : null,
            }
          : t,
      ),
    }))
  }

  const removeTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      estimateTasks: prev.estimateTasks.filter((t) => t.id !== id),
    }))
    showToast('削除しました')
  }

  return (
    <div className="targets-tab estimate-tasks-tab">
      <p className="hint">
        <strong>提出期限</strong>に応じて<strong>案件名</strong>の色が変わります（完了にチェックを入れると消えます）。
        <strong>あと2日・3日</strong>で黄色、<strong>あと1日</strong>で赤、<strong>当日・超過</strong>で赤の点滅です。
        <strong>残り日数</strong>列と行の色で期限を把握しやすくしています。未完了は期限の早い順、<strong>完了済みは一覧の下</strong>に並びます。下の表は<strong>チェック済み（提出済み）</strong>の件数だけを数えます。
      </p>

      <section className="panel user-bar" aria-label="表示範囲">
        <DataViewUserSelectBar
          users={users}
          dataViewUserIds={dataViewUserIds}
          setState={setState}
          showHint
        />
      </section>

      <section className="panel">
        <h2 className="targets-heading">タスクを追加</h2>
        <form onSubmit={addTask}>
          <div className="targets-add-form estimate-tasks-add-form">
            <label className="field">
              <span className="field-label">案件名</span>
            <input
              type="text"
              className="cell-input grow"
              value={formProject}
              onChange={(e) => setFormProject(e.target.value)}
              placeholder="例：〇〇工事 見積"
            />
          </label>
          <label className="field">
            <span className="field-label">顧客名</span>
            <input
              type="text"
              className="cell-input grow"
              value={formCustomer}
              onChange={(e) => setFormCustomer(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">顧客担当者</span>
            <input
              type="text"
              className="cell-input grow"
              value={formContact}
              onChange={(e) => setFormContact(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">見積もり担当者</span>
            <select
              className="cell-input"
              value={formAssignee}
              onChange={(e) => setFormAssignee(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">提出期限</span>
            <input
              type="date"
              className="cell-input"
              min={today}
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary">
            追加
          </button>
          </div>
          <p className="hint small estimate-tasks-deadline-hint">
            新規の提出期限は<strong>今日以降</strong>から選べます（過去日が必要な場合は追加後に一覧で変更できます）。
          </p>
        </form>
      </section>

      <section className="panel targets-table-panel">
        <h2 className="targets-heading">見積もりタスク一覧</h2>
        {sortedVisible.length === 0 ? (
          <p className="hint">該当するタスクがありません（表示範囲を変えるか、タスクを追加してください）。</p>
        ) : (
          <div className={narrowLayout ? 'estimate-tasks-scroll' : undefined}>
            <table className="targets-table estimate-tasks-table">
              <thead>
                <tr>
                  <th className="estimate-tasks-col-check">完了</th>
                  <th>案件名</th>
                  <th>顧客名</th>
                  <th>顧客担当者</th>
                  {showOwnerCol ? <th>見積担当</th> : null}
                  <th>提出期限</th>
                  <th className="estimate-tasks-col-remaining">残り日数</th>
                  <th className="estimate-tasks-col-action">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedVisible.map((t) => {
                  const tone = projectNameToneClass(t, today)
                  const dl = daysLeftUntilDeadline(t, today)
                  const remClass = remainingCellClass(dl)
                  const rowBg = rowUrgencyClass(t, today)
                  const trClass = [
                    t.completed ? 'estimate-task-row-done' : '',
                    rowBg,
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <tr key={t.id} className={trClass || undefined}>
                      <td>
                        <label className="estimate-task-check-label">
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={(e) => setCompleted(t.id, e.target.checked)}
                            aria-label={`「${t.projectName}」を完了にする`}
                          />
                        </label>
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`cell-input table-cell-wide estimate-task-project-input ${tone}`}
                          value={t.projectName}
                          onChange={(e) =>
                            patchTask(t.id, { projectName: e.target.value })
                          }
                          disabled={t.completed}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="cell-input table-cell-wide"
                          value={t.customerName}
                          onChange={(e) =>
                            patchTask(t.id, { customerName: e.target.value })
                          }
                          disabled={t.completed}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="cell-input table-cell-wide"
                          value={t.customerContact}
                          onChange={(e) =>
                            patchTask(t.id, { customerContact: e.target.value })
                          }
                          disabled={t.completed}
                        />
                      </td>
                      {showOwnerCol ? (
                        <td>
                          <select
                            className="cell-input"
                            value={t.assigneeUserId}
                            onChange={(e) =>
                              patchTask(t.id, { assigneeUserId: e.target.value })
                            }
                            disabled={t.completed}
                          >
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td>
                        <input
                          type="date"
                          className="cell-input"
                          value={t.deadline}
                          onChange={(e) =>
                            patchTask(t.id, { deadline: e.target.value })
                          }
                          disabled={t.completed}
                        />
                        {t.completed && t.completedAt ? (
                          <span className="hint small estimate-task-completed-at">
                            完了日 {formatDateJa(t.completedAt)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`estimate-task-remaining ${remClass}`}>
                          {formatRemainingLabel(dl)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn danger ghost"
                          onClick={() => {
                            if (window.confirm('このタスクを削除しますか？')) {
                              removeTask(t.id)
                            }
                          }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel estimate-tasks-stats-panel">
        <h2 className="targets-heading">提出済み見積もり件数（社内）</h2>
        <p className="hint small">
          完了にチェックを入れたタスクを、<strong>完了日</strong>の暦月・会計年度で集計しています（表示範囲の絞り込みは影響しません）。
        </p>
        <div className="estimate-tasks-stats-controls">
          <label className="field inline">
            <span className="field-label">集計する暦月</span>
            <input
              type="month"
              className="cell-input"
              value={focusYm}
              onChange={(e) => setFocusYm(e.target.value)}
            />
          </label>
          <label className="field inline">
            <span className="field-label">集計する会計年度</span>
            <select
              className="cell-input"
              value={focusFyStartYear}
              onChange={(e) => setFocusFyStartYear(Number(e.target.value))}
            >
              {fyYearOptions.map((y) => (
                <option key={y} value={y}>
                  {fiscalYearRangeLabel(y, fiscalSm)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table className="targets-table estimate-tasks-stats-table">
          <thead>
            <tr>
              <th>見積もり担当</th>
              <th>選択した月の提出済</th>
              <th>選択した年度の提出済</th>
            </tr>
          </thead>
          <tbody>
            {statsRows.perUser.map((r) => (
              <tr key={r.userId}>
                <td>{r.name}</td>
                <td>{r.month}</td>
                <td>{r.fy}</td>
              </tr>
            ))}
            <tr className="estimate-tasks-stats-total">
              <td>
                <strong>社内全員</strong>
              </td>
              <td>
                <strong>{statsRows.monthTotal}</strong>
              </td>
              <td>
                <strong>{statsRows.fyTotal}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
