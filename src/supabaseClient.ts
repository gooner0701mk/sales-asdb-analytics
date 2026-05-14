import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Vercel などに貼った値の前後の引用符・空白を除く */
function trimEnvValue(s: string | undefined): string | undefined {
  if (s == null) return undefined
  const t = s.trim().replace(/^['"]+|['"]+$/g, '')
  return t || undefined
}

/**
 * Supabase の Project URL に正規化（誤って /rest/v1 を付けた設定の救済）。
 */
export function normalizeSupabaseProjectUrl(raw: string): string {
  let u = raw.trim().replace(/^['"]+|['"]+$/g, '')
  u = u.replace(/\/rest\/v1\/?$/i, '')
  u = u.replace(/\/$/, '')
  return u
}

const urlRaw = trimEnvValue(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonRaw = trimEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
const url = urlRaw ? normalizeSupabaseProjectUrl(urlRaw) : undefined
const anon = anonRaw

/** 本番・検証で Supabase を使うとき true（.env に URL / anon key を設定） */
export const isSupabaseConfigured = Boolean(
  url && anon && /^https?:\/\//i.test(url),
)

let client: SupabaseClient | null = null

/** 他アプリと衝突・壊れたセッションを避けるため固定キー（変更すると全員一度ログアウト） */
export const SUPABASE_AUTH_STORAGE_KEY = 'sales-newbiz-supabase-auth'

/** セッションストレージを消したあとにクライアントを作り直す */
export function resetSupabaseClient(): void {
  client = null
}

/**
 * 端末に残った壊れたトークンなどを消す（ログインできないときの救済）。
 * 呼び出し後はページの再読み込みを推奨。
 */
export async function clearSupabaseBrowserSession(): Promise<void> {
  try {
    const sb = getSupabase()
    await sb?.auth.signOut({ scope: 'local' })
  } catch {
    /* 壊れた JSON などで失敗しても続行 */
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(SUPABASE_AUTH_STORAGE_KEY)) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* プライベートモード等 */
  }
  resetSupabaseClient()
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || !url || !anon) return null
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
      },
    })
  }
  return client
}
