import { useCallback, useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import './CloudLoginScreen.css'

export function CloudLoginScreen() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setMessage(null)
      setBusy(true)
      try {
        if (mode === 'login') {
          const { error } = await signIn(email.trim(), password)
          if (error) setMessage(error)
        } else {
          const { error } = await signUp(email.trim(), password)
          if (error) {
            setMessage(error)
          } else {
            setMessage(
              '登録しました。メール確認を有効にしている場合は、届いたメールのリンクから有効化してからログインしてください。',
            )
            setMode('login')
          }
        }
      } finally {
        setBusy(false)
      }
    },
    [email, password, mode, signIn, signUp],
  )

  return (
    <div className="cloud-login-screen">
      <div className="cloud-login-card">
        <h1 className="cloud-login-title">営業データ分析</h1>
        <p className="cloud-login-lead">
          クラウド保存モードです。アカウントにログインすると、データは Supabase 上のあなた専用の領域に保存されます。
        </p>
        <div className="cloud-login-seg" role="group" aria-label="モード">
          <button
            type="button"
            className={`cloud-login-seg-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setMessage(null)
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`cloud-login-seg-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup')
              setMessage(null)
            }}
          >
            アカウント作成
          </button>
        </div>
        <form className="cloud-login-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">メールアドレス</span>
            <input
              type="email"
              className="cell-input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">パスワード</span>
            <input
              type="password"
              className="cell-input"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="btn primary cloud-login-submit" disabled={busy}>
            {busy ? '処理中…' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>
        {message ? <p className="cloud-login-message">{message}</p> : null}
        <p className="hint small cloud-login-foot">
          開発時は <code>.env</code> の <code>VITE_SUPABASE_URL</code> /{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> を設定し、Supabase でテーブルと RLS を作成してください（
          <code>supabase/migrations</code> 参照）。
        </p>
      </div>
    </div>
  )
}
