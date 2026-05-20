import { createId } from './createId'
import type { User } from './types'

/** Sales / activity analytics scope (false = attendance only). */
export function includeUserInSalesAnalytics(u: User): boolean {
  return u.includeInSalesAnalytics !== false
}

export function usersForSalesAnalytics(users: User[]): User[] {
  return users.filter(includeUserInSalesAnalytics)
}

export function normalizeUser(x: unknown): User | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!id || !name) return null
  return {
    id,
    name,
    includeInSalesAnalytics: o.includeInSalesAnalytics === false ? false : true,
  }
}

export function normalizeUsers(raw: unknown): User[] {
  if (!Array.isArray(raw)) return []
  const out: User[] = []
  for (const item of raw) {
    const u = normalizeUser(item)
    if (u) out.push(u)
  }
  return out
}

export function newAttendanceOnlyUser(name: string): User {
  return {
    id: createId(),
    name: name.trim() || '\u7121\u540D',
    includeInSalesAnalytics: false,
  }
}
