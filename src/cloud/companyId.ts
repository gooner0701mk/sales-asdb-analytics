/** ビルド時に固定するテナントID（英小文字・数字・-_ のみに正規化）。未設定は default。 */
export function cloudCompanyId(): string {
  const raw = import.meta.env.VITE_COMPANY_ID as string | undefined
  const t = (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '')
  if (!t) return 'default'
  const slug = t
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const out = slug.slice(0, 64)
  return out || 'default'
}
