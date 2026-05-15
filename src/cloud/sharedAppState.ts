import { getSupabase } from '../supabaseClient'
import { cloudCompanyId } from './companyId'
import { stateToJson } from '../stateJson'
import type { AppState } from '../types'
import { normalizeStoredStateRecord } from '../storage'

/**
 * Supabase の shared_app_state（会社共有・company_id ごと1行）の payload を AppState にする。
 */
export async function fetchSharedAppState(): Promise<AppState | null> {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from('shared_app_state')
    .select('payload')
    .eq('company_id', cloudCompanyId())
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

/**
 * 会社共有の payload を保存（最後の保存が優先。同時編集は想定外の取りこぼしあり得る）。
 */
export async function upsertSharedAppState(state: AppState): Promise<void> {
  const sb = getSupabase()
  if (!sb) return

  const payload = JSON.parse(stateToJson(state)) as Record<string, unknown>
  const { error } = await sb.from('shared_app_state').upsert(
    {
      company_id: cloudCompanyId(),
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  )

  if (error) throw error
}
