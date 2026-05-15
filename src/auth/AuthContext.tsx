import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { friendlyResendError, friendlySignInError, friendlySignUpError } from './authErrorMessages'
import { withAuthTimeout } from './authTimeout'
import { clearSupabaseBrowserSession, getSupabase, isSupabaseConfigured } from '../supabaseClient'
import { cloudCompanyId } from '../cloud/companyId'

/**
 * 確認メールの `emailRedirectTo` 用。
 * - `VITE_AUTH_EMAIL_REDIRECT_URL` があれば最優先（本番URLを固定して Supabase の Redirect URLs と揃えやすくする）
 * - なければ現在のページの origin（従来どおり）
 */
function emailRedirectToForAuth(): string | undefined {
  const raw = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_URL as string | undefined
  if (raw != null && String(raw).trim() !== '') {
    const t = String(raw).trim().replace(/^['"]+|['"]+$/g, '')
    try {
      const u = new URL(t)
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        const base = `${u.origin}${u.pathname.replace(/\/+$/, '')}`
        return `${base}/`
      }
    } catch {
      /* 無視して window にフォールバック */
    }
  }
  if (typeof window === 'undefined') return undefined
  const { origin } = window.location
  if (!origin || origin === 'null') return undefined
  return `${origin.replace(/\/$/, '')}/`
}

export type SignUpResult = {
  error: string | null
  /** メール確認が有効で、セッションがまだ無い＝確認メール待ち */
  pendingEmailConfirmation: boolean
}

type AuthContextValue = {
  configured: boolean
  ready: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  /** アカウント作成の確認メールを再送（Supabase の resend） */
  resendSignupEmail: (email: string) => Promise<{ error: string | null }>
  /** 端末に保存された Supabase 認証データを消去（ログインできないときの救済） */
  clearLocalAuthSession: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      setReady(true)
      return
    }

    const BOOTSTRAP_MS = 12_000
    void (async () => {
      try {
        const { data } = await Promise.race([
          sb.auth.getSession(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('SESSION_BOOTSTRAP_TIMEOUT')), BOOTSTRAP_MS),
          ),
        ])
        setSession(data.session ?? null)
      } catch (e) {
        console.error('[AuthProvider] getSession', e)
        setSession(null)
      } finally {
        setReady(true)
      }
    })()

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase が未設定です' }
    try {
      return await withAuthTimeout(async () => {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        return { error: friendlySignInError(error?.message) }
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_TIMEOUT') {
        return {
          error:
            'サーバーからの応答がありません（タイムアウト）。電波・Wi‑Fi を確認し、ページを再読み込みしてから再度お試しください。',
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}` }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase が未設定です', pendingEmailConfirmation: false }
    const redirectTo = emailRedirectToForAuth()
    try {
      return await withAuthTimeout(async () => {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
            data: { company_id: cloudCompanyId() },
          },
        })
        if (error) {
          return {
            error: friendlySignUpError(error.message) ?? error.message ?? '登録に失敗しました',
            pendingEmailConfirmation: false,
          }
        }
        const pending = Boolean(data.user) && !data.session
        return { error: null, pendingEmailConfirmation: pending }
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_TIMEOUT') {
        return {
          error:
            'サーバーからの応答がありません（タイムアウト）。登録が完了している可能性もあるので、迷惑メールを確認のうえ「確認メールを再送」または「ログイン」を試してください。',
          pendingEmailConfirmation: false,
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}`, pendingEmailConfirmation: false }
    }
  }, [])

  const resendSignupEmail = useCallback(async (email: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase が未設定です' }
    const redirectTo = emailRedirectToForAuth()
    try {
      return await withAuthTimeout(async () => {
        const { error } = await sb.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
        })
        return { error: friendlyResendError(error?.message) }
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'AUTH_TIMEOUT') {
        return {
          error:
            'サーバーからの応答がありません（タイムアウト）。しばらくしてから再度「再送」を試してください。',
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}` }
    }
  }, [])

  const clearLocalAuthSession = useCallback(async () => {
    await clearSupabaseBrowserSession()
  }, [])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) return
    await sb.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      ready,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      resendSignupEmail,
      clearLocalAuthSession,
      signOut,
    }),
    [ready, session, signIn, signUp, resendSignupEmail, clearLocalAuthSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth は AuthProvider 内でのみ使えます')
  }
  return ctx
}
