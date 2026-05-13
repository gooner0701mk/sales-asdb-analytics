import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, DataViewUserIds, User } from './types'
import { dataViewSummaryLabel } from './dataViewSelection'

type Props = {
  users: User[]
  dataViewUserIds: DataViewUserIds
  setState: Dispatch<SetStateAction<AppState>>
  /** false のときは説明テキストを出さない（分析タブのユーザー行向け） */
  showHint?: boolean
}

export function DataViewUserSelectBar({
  users,
  dataViewUserIds,
  setState,
  showHint = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isAll = dataViewUserIds === 'all'
  const selectedSet = isAll ? null : new Set(dataViewUserIds)

  /** 「全員」をオフにしたら、まず全ユーザーを個別チェック済みにする（ここから自分だけ外す等が可能） */
  const setAllMode = (all: boolean) => {
    setState((prev) => ({
      ...prev,
      dataViewUserIds: all ? 'all' : prev.users.map((u) => u.id),
    }))
  }

  const toggleUser = (userId: string) => {
    setState((prev) => {
      let cur = prev.dataViewUserIds
      if (cur === 'all') return prev
      const set = new Set(cur)
      if (set.has(userId)) set.delete(userId)
      else set.add(userId)
      const next = [...set]
      if (prev.users.length > 0 && next.length >= prev.users.length) {
        return { ...prev, dataViewUserIds: 'all' }
      }
      return { ...prev, dataViewUserIds: next }
    })
  }

  const summary = dataViewSummaryLabel(dataViewUserIds, users)

  return (
    <div
      ref={rootRef}
      className={`tab-view-scope-bar data-view-dd-root ${open ? 'data-view-dd-open' : ''}`}
      role="group"
      aria-label="表示するデータの担当"
    >
      <div className="field inline tab-view-scope-field data-view-dd-field">
        <span className="field-label" id={`${listId}-label`}>
          データ表示
        </span>
        <div className="data-view-dd">
          <button
            type="button"
            className="cell-input tab-view-scope-select excel-like-select data-view-dd-trigger"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-labelledby={`${listId}-label`}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="data-view-dd-trigger-text">{summary}</span>
            <span className="data-view-dd-chevron" aria-hidden>
              ▼
            </span>
          </button>
          {open && (
            <div
              id={listId}
              className="data-view-dd-panel"
              role="listbox"
              aria-multiselectable
            >
              <label className="data-view-dd-row data-view-dd-row-all">
                <input
                  type="checkbox"
                  checked={isAll}
                  onChange={(e) => setAllMode(e.target.checked)}
                />
                <span>全員</span>
              </label>
              <div className="data-view-dd-divider" role="separator" />
              {users.map((u) => (
                <label key={u.id} className="data-view-dd-row">
                  <input
                    type="checkbox"
                    checked={isAll || (selectedSet?.has(u.id) ?? false)}
                    disabled={isAll}
                    onChange={() => {
                      if (!isAll) toggleUser(u.id)
                    }}
                  />
                  <span>{u.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      {showHint ? (
        <span className="muted tab-view-scope-meta">
          {isAll ? (
            <>登録済みの<strong>すべてのユーザー</strong>のデータを表示しています。</>
          ) : (
            <>
              選択中: <strong>{summary}</strong>
              。「全員」を外すと<strong>全員分のチェックが入った状態</strong>から始まるので、不要な人のチェックを外して
              <strong>自分以外だけ</strong>や<strong>1人ずつ</strong>の組み合わせに絞れます。誰もチェックしないとデータは表示されません。活動の新規登録は
              <strong>記録する担当</strong>に紐づきます。
            </>
          )}
        </span>
      ) : null}
    </div>
  )
}
