import { getSupabase } from '../supabaseClient'
import { stateToJson } from '../stateJson'
import type { AppState } from '../types'
import { normalizeStoredStateRecord } from '../storage'

/**
 * Supabase の user_app_state.payload（JSON）を AppState にする。
 * 行がない・壊れている場合は null。
 */
export async function fetchUserAppState(userId: string): Promise<AppState | null> {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from('user_app_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  const raw = data?.payload
  if (raw == null) return null

  try {
    const o =
      typeof raw === 'string' ? (JSON.parse(raw) as unknown) : (raw as unknown)
    if (!o || typeof o !== 'object') return null
    const rec = o as Record<string, unknown>
    if (rec.version !== 8 || !Array.isArray(rec.activities)) return null
    return normalizeStoredStateRecord(rec)
  } catch {
    return null
  }
}

export async function upsertUserAppState(
  userId: string,
  state: AppState,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const payload = JSON.parse(stateToJson(state)) as Record<string, unknown>
  const { error } = await sb.from('user_app_state').upsert(
    {
      user_id: userId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}
