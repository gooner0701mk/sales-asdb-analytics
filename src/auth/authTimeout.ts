const AUTH_REQUEST_MS = 28_000

/**
 * モバイル回線などで Auth API が応答しないとき、画面が「処理中…」のまま固まらないようにする。
 */
export async function withAuthTimeout<T>(fn: () => Promise<T>): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_REQUEST_MS)
  })
  try {
    return await Promise.race([fn(), timeout])
  } finally {
    if (id !== undefined) clearTimeout(id)
  }
}
