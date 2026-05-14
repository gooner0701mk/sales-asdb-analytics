/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 確認メールのリンク先を固定（例: 本番のみ）。未設定時は現在の origin を使用 */
  readonly VITE_AUTH_EMAIL_REDIRECT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
