import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import './CloudLoginScreen.css'

function isLanOrLocalHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  return /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

export function CloudLoginScreen() {
  const { signIn, signUp, resendSignupEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0)
  const [, setCooldownTick] = useState(0)

  useEffect(() => {
    if (resendCooldownUntil <= Date.now()) return
    const id = window.setInterval(() => {
      setCooldownTick((n) => n + 1)
      if (Date.now() >= resendCooldownUntil) {
        window.clearInterval(id)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendCooldownUntil])

  const lanRedirectHint = useMemo(() => {
    if (typeof window === 'undefined') return null
    const { hostname, origin } = window.location
    if (!isLanOrLocalHostname(hostname)) return null
    return `${origin}/**`
  }, [])

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
          const { error, pendingEmailConfirmation } = await signUp(
            email.trim(),
            password,
          )
          if (error) {
            setMessage(error)
            setAwaitingEmailConfirmation(false)
          } else if (pendingEmailConfirmation) {
            setAwaitingEmailConfirmation(true)
            setMessage(null)
            setResendCooldownUntil(Date.now() + 45000)
          } else {
            setAwaitingEmailConfirmation(false)
            setMessage(
              '登録が完了しました。このままログインできる場合は、上の「ログイン」に切り替えてください。',
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

  const resendCooldownLeftMs = Math.max(0, resendCooldownUntil - Date.now())
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canResend = emailLooksValid && resendCooldownLeftMs === 0 && !resendBusy

  const onResendSignup = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      setMessage('メールアドレスを入力してください')
      return
    }
    setMessage(null)
    setResendBusy(true)
    try {
      const { error } = await resendSignupEmail(trimmed)
      if (error) {
        setMessage(error)
      } else {
        setMessage(
          '確認メールを再送しました。届くまで数分かかることがあります。迷惑メールフォルダもご確認ください。',
        )
        setResendCooldownUntil(Date.now() + 60000)
      }
    } finally {
      setResendBusy(false)
    }
  }, [email, resendSignupEmail])

  return (
    <div className="cloud-login-screen">
      <div
        className={`cloud-login-card${awaitingEmailConfirmation ? ' cloud-login-card-await' : ''}`}
      >
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
              setAwaitingEmailConfirmation(false)
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
              setAwaitingEmailConfirmation(false)
            }}
          >
            アカウント作成
          </button>
        </div>
        {!awaitingEmailConfirmation ? (
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
        ) : null}
        {!awaitingEmailConfirmation && mode === 'login' ? (
          <div className="cloud-login-login-extras">
            <p className="hint small cloud-login-login-extras-text">
              登録したが<strong>確認メールが届かない</strong>ときは、上にメールアドレスを入力してから次を押してください。
            </p>
            <button
              type="button"
              className="btn ghost cloud-login-login-resend"
              disabled={!emailLooksValid || !canResend || resendBusy}
              onClick={() => {
                void onResendSignup()
              }}
            >
              {resendBusy
                ? '再送中…'
                : resendCooldownLeftMs > 0
                  ? `再送まで ${Math.ceil(resendCooldownLeftMs / 1000)} 秒`
                  : '確認メールを再送する'}
            </button>
          </div>
        ) : null}
        {awaitingEmailConfirmation ? (
          <div
            className={`cloud-login-email-await${lanRedirectHint ? ' cloud-login-email-await-lan' : ''}`}
            role="status"
          >
            <p className="cloud-login-email-await-title">
              確認メールを送信しました
            </p>
            <p className="cloud-login-email-await-lead">
              <strong>{email.trim()}</strong> 宛です。スマホ・iPad のメールアプリでは次の場所も必ず確認してください。
            </p>
            <ul className="cloud-login-email-await-list">
              <li>
                <strong>迷惑メール・ジャンク・プロモーション</strong>（Gmail・iCloud メールなど）
              </li>
              <li>
                <strong>数分待ってから</strong>再読み込み（届きが遅れることがあります）
              </li>
              <li>
                メール内のリンクから戻る先は{' '}
                <strong>
                  {typeof window !== 'undefined' ? window.location.origin : 'このサイト'}
                </strong>{' '}
                です。Supabase の <strong>Authentication → URL Configuration → Redirect URLs</strong>{' '}
                に、このオリジンを含む行（例:{' '}
                <code>
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/**`
                    : 'https://（サイト）/**'}
                </code>
                ）が<strong>必ず</strong>入っているか確認してください（未設定だとメールは届いてもリンク先で弾かれます）。
              </li>
              <li>会社メールの場合、<strong>外部からのメールがブロック</strong>されていないか（セキュリティ・受信許可）も確認してください。</li>
            </ul>
            <div className="cloud-login-email-await-actions">
              <button
                type="button"
                className="btn primary cloud-login-resend"
                disabled={!canResend}
                onClick={() => {
                  void onResendSignup()
                }}
              >
                {resendBusy
                  ? '再送中…'
                  : resendCooldownLeftMs > 0
                    ? `再送まで ${Math.ceil(resendCooldownLeftMs / 1000)} 秒`
                    : '確認メールを再送する'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAwaitingEmailConfirmation(false)
                  setMode('signup')
                  setPassword('')
                  setMessage(null)
                }}
              >
                別のアドレスでやり直す
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAwaitingEmailConfirmation(false)
                  setMode('login')
                  setMessage(
                    'メール内のリンクで確認できたら、メールアドレスとパスワードでログインしてください。',
                  )
                }}
              >
                確認が終わったらログインへ
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p className="cloud-login-message" role="alert">
            {message}
          </p>
        ) : null}
        {lanRedirectHint ? (
          <div className="cloud-login-lan-hint" role="note">
            <strong>スマホや LAN の IP で開いているとき:</strong>
            Supabase の{' '}
            <strong>Authentication → URL Configuration → Redirect URLs</strong>{' '}
            に次を<strong>1行追加</strong>してください（コピー用）。
            <br />
            <code className="cloud-login-lan-code">{lanRedirectHint}</code>
            <span className="cloud-login-lan-sub">
              IP やポートは PC のターミナル（
              <code>Network: http://…</code>
              ）と一致させてください。メール確認リンクやパスワード再設定でも同じオリジンが使われます。
            </span>
          </div>
        ) : null}
        {import.meta.env.DEV ? (
        <p className="hint small cloud-login-foot">
          開発時は <code>.env</code> の <code>VITE_SUPABASE_URL</code> /{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> を設定し、Supabase でテーブルと RLS を作成してください（
          <code>supabase/migrations</code> 参照）。
        </p>
        ) : (
          <p className="hint small cloud-login-foot cloud-login-foot-prod">
            メールが届かない場合は迷惑メールを確認し、Supabase ダッシュボードの{' '}
            <strong>Authentication → Emails</strong> でカスタム SMTP の利用も検討してください。
          </p>
        )}
      </div>
    </div>
  )
}
