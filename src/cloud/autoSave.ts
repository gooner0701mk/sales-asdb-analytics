import { upsertSharedAppState } from './sharedAppState'
import { stateToJson } from '../stateJson'
import { saveState } from '../storage'
import type { AppState } from '../types'

export const CLOUD_AUTO_SAVE_DEBOUNCE_MS = 900

export type CloudSavePhase = 'idle' | 'pending' | 'syncing' | 'ok' | 'error'

export type CloudSaveStatus = {
  phase: CloudSavePhase
  lastOkAt: number | null
}

/** ローカル退避＋Supabase へ保存 */
export async function persistAppStateToCloud(state: AppState): Promise<void> {
  saveState(state)
  await upsertSharedAppState(state)
}

export function stateJsonFingerprint(state: AppState): string {
  return stateToJson(state)
}
