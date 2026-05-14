/**
 * Supabase Auth の英語メッセージを、画面向けの日本語に寄せる。
 * 未知の文言はそのまま返す。
 */
export function friendlySignInError(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()

  if (lower.includes('email not confirmed')) {
    return 'メールアドレスの確認がまだです。登録時に届いたメール内のリンクを開いてから、もう一度ログインしてください。'
  }
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials')
  ) {
    return 'メールアドレスまたはパスワードが違います。新規登録直後の場合は、先に確認メールのリンクを開いてからログインしてください。'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return '試行回数が多すぎます。数分待ってから再度お試しください。'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return `通信に失敗しました（${raw}）。電波・Wi‑Fi を確認し、ページを再読み込みしてから試してください。`
  }
  return raw
}

export function friendlyResendError(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes('for security purposes') || lower.includes('only request')) {
    return '再送は一定時間に何度もできません。数分待ってから再度お試しください。'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return '試行回数が多すぎます。しばらく待ってから再度お試しください。'
  }
  return raw
}
