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
    return '試行回数が多すぎます（Supabase のレート制限）。15〜60 分ほど空けてから再度お試しください。社内で同じ回線から続けて登録している場合も起きやすいです。改善しないときは Supabase ダッシュボードの Authentication で制限やメール送信の状況を確認してください。'
  }
  if (lower.includes('jwt') || lower.includes('session expired')) {
    return '保存されたログイン情報が壊れているか期限切れです。ログイン画面の「保存した認証情報を消去」を押してから、再度ログインしてください。'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return `通信に失敗しました（${raw}）。電波・Wi‑Fi を確認し、ページを再読み込みしてから試してください。`
  }
  return raw
}

export function friendlySignUpError(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()

  if (
    lower.includes('already registered') ||
    lower.includes('user already') ||
    lower.includes('already been registered')
  ) {
    return 'このメールアドレスは既に登録されています。「ログイン」に切り替えて試すか、未確認なら下の「確認メールを再送」を試してください。'
  }
  if (lower.includes('invalid email')) {
    return 'メールアドレスの形式が正しくないようです。打ち間違い（例: @gmail.com の末尾）を確認してください。'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return '試行回数が多すぎます（Supabase のレート制限）。15〜60 分ほど空けてから、もう一度「登録する」を押してください。確認メールの再送も控えめにすると解除が早くなることがあります。'
  }
  if (lower.includes('password')) {
    return raw
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
    return '試行回数が多すぎます（Supabase のレート制限）。しばらく時間を空けてから「確認メールを再送」を試してください。'
  }
  if (lower.includes('not found') || lower.includes('no user')) {
    return 'このメールアドレスでの未完了の登録が見つかりません。アカウント作成からやり直すか、メールアドレスを確認してください。'
  }
  return raw
}
