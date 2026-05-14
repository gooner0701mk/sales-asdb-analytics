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
import { friendlyResendError, friendlySignInError } from './authErrorMessages'
import { getSupabase, isSupabaseConfigured } from '../supabaseClient'

function emailRedirectToOrigin(): string | undefined {
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

    void sb.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s)
        setReady(true)
      })
      .catch((err) => {
        console.error('[AuthProvider] getSession', err)
        setReady(true)
      })

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
      const { error } = await sb.auth.signInWithPassword({ email, password })
      return { error: friendlySignInError(error?.message) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}` }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase が未設定です', pendingEmailConfirmation: false }
    const redirectTo = emailRedirectToOrigin()
    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
      if (error) {
        return { error: error.message ?? '登録に失敗しました', pendingEmailConfirmation: false }
      }
      const pending = Boolean(data.user) && !data.session
      return { error: null, pendingEmailConfirmation: pending }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}`, pendingEmailConfirmation: false }
    }
  }, [])

  const resendSignupEmail = useCallback(async (email: string) => {
    const sb = getSupabase()
    if (!sb) return { error: 'Supabase が未設定です' }
    const redirectTo = emailRedirectToOrigin()
    try {
      const { error } = await sb.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
      return { error: friendlyResendError(error?.message) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `通信エラー: ${msg}` }
    }
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
      signOut,
    }),
    [ready, session, signIn, signUp, resendSignupEmail, signOut],
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
