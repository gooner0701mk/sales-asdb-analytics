import { sha256Hex } from './sha256'

/** ??????????? SHA-256?16?? */
export async function hashAttendancePassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  return sha256Hex(data)
}

export async function verifyAttendancePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!hash.trim()) return false
  const got = await hashAttendancePassword(plain)
  return got === hash.trim()
}
