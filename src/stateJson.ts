import { syncApproachTargetsFromActivities } from './approachTargets'
import { mergeChartColors } from './chartColors'
import { normalizeStoredStateRecord } from './storage'
import type {
  ActivityLog,
  ApproachTarget,
  AppState,
  User,
  UserMilestones,
} from './types'
import { emptyMilestones } from './types'

function isUser(x: unknown): x is User {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.name === 'string'
}

function isApproachTarget(x: unknown): x is ApproachTarget {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.companyName === 'string' &&
    typeof r.ownerUserId === 'string' &&
    (r.lastApproachDate === null ||
      (typeof r.lastApproachDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.lastApproachDate)))
  )
}

export function stateToJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function parseStateJson(text: string): AppState {
  const p = JSON.parse(text) as unknown
  if (!p || typeof p !== 'object') throw new Error('形式が不正です')
  const o = p as Record<string, unknown>
  if (o.version !== 5 && o.version !== 6 && o.version !== 7 && o.version !== 8) {
    throw new Error('version: 5 ～ 8 のデータのみ取り込めます')
  }
  if (!Array.isArray(o.users)) throw new Error('users が配列ではありません')
  const users = o.users.filter(isUser)
  if (users.length === 0) throw new Error('ユーザーが1人以上必要です')
  if (!Array.isArray(o.activities)) throw new Error('activities が配列ではありません')

  const base = normalizeStoredStateRecord({
    ...o,
    users,
  })

  const sessionUserId =
    typeof base.sessionUserId === 'string' &&
    base.users.some((u) => u.id === base.sessionUserId)
      ? base.sessionUserId
      : base.users[0]!.id

  const milestonesByUser: Record<string, UserMilestones> = {
    ...base.milestonesByUser,
  }
  for (const u of base.users) {
    if (!milestonesByUser[u.id]) milestonesByUser[u.id] = emptyMilestones()
  }

  const approachTargets: ApproachTarget[] = Array.isArray(base.approachTargets)
    ? base.approachTargets.filter(isApproachTarget)
    : []

  return {
    ...base,
    version: 8,
    sessionUserId,
    milestonesByUser,
    approachTargets: syncApproachTargetsFromActivities(
      approachTargets,
      base.activities,
    ),
    chartColors: mergeChartColors(base.chartColors),
  }
}

export function mergeActivityCsvIntoState(
  prev: AppState,
  activities: ActivityLog[],
): AppState {
  const nextActivities = activities.length ? activities : prev.activities
  return {
    ...prev,
    activities: nextActivities,
    approachTargets: syncApproachTargetsFromActivities(
      prev.approachTargets,
      nextActivities,
    ),
  }
}
