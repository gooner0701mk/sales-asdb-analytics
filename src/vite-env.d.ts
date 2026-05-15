/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 確認メールのリンク先を固定（例: 本番のみ）。未設定時は現在の origin を使用 */
  readonly VITE_AUTH_EMAIL_REDIRECT_URL?: string
  /** クラウド共有のテナントID（未設定は default）。同一 Supabase 内で会社ごとに別行に分離 */
  readonly VITE_COMPANY_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
