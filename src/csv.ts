import type { ActivityLog, ActivityType } from './types'
import { parseLeadSourceIdForImport } from './types'
import { createId } from './createId'

const ACT_HEADER =
  'date,customerName,leadSource,activityType,quoteCount,orderCount,userId'

const ACT_TYPES: ActivityType[] = ['coldVisit', 'teleAppo', 'meeting', 'reception']

function isActivityType(s: string): s is ActivityType {
  return ACT_TYPES.includes(s as ActivityType)
}

export function activitiesToCSV(rows: ActivityLog[]): string {
  const sorted = [...rows].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.customerName.localeCompare(b.customerName)
  })
  const lines = [
    ACT_HEADER,
    ...sorted.map((r) => {
      const ls =
        r.leadSource === null || r.leadSource === undefined
          ? ''
          : r.leadSource
      return `${r.date},${escapeCsv(r.customerName)},${ls},${r.activityType},${r.quoteCount},${r.orderCount},${r.userId}`
    }),
  ]
  return lines.join('\r\n')
}

function escapeCsv(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function parseNum(s: string): number {
  const n = Number(String(s).trim())
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/** 活動ログCSV（1行ヘッダー）。userId 列が無い場合は defaultUserId を付与 */
export function parseActivityCSV(
  text: string,
  defaultUserId: string,
  allowedLeadSourceIds: Set<string>,
): ActivityLog[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('データ行がありません')

  const head = parseCsvLine(lines[0]!).map((c) => c.trim().toLowerCase())
  const idx = (name: string) => head.indexOf(name.toLowerCase())
  const iDate = idx('date')
  const iCust = idx('customername')
  const iLead = idx('leadsource')
  const iType = idx('activitytype')
  const iQuote = idx('quotecount')
  const iOrder = idx('ordercount')
  const iUser = idx('userid')
  if (iDate < 0 || iCust < 0 || iType < 0 || iQuote < 0 || iOrder < 0) {
    throw new Error(
      `必須列: date,customerName,activityType,quoteCount,orderCount（leadSource・userId は任意）`,
    )
  }

  const out: ActivityLog[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!)
    const date = (cols[iDate] ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const activityTypeRaw = (cols[iType] ?? '').trim()
    if (!isActivityType(activityTypeRaw)) continue
    const uid =
      iUser >= 0 && (cols[iUser] ?? '').trim()
        ? (cols[iUser] ?? '').trim()
        : defaultUserId
    const leadRaw =
      iLead >= 0
        ? parseLeadSourceIdForImport((cols[iLead] ?? '').trim(), allowedLeadSourceIds)
        : null
    out.push({
      id: createId(),
      userId: uid,
      date,
      customerName: (cols[iCust] ?? '').trim() || '（名称なし）',
      leadSource: leadRaw,
      activityType: activityTypeRaw,
      quoteCount: parseNum(cols[iQuote] ?? '0'),
      orderCount: parseNum(cols[iOrder] ?? '0'),
    })
  }
  return out
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQ = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export function downloadCSV(filename: string, csv: string): void {
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadText(filename: string, text: string, mime: string): void {
  const bom = '\uFEFF'
  const blob = new Blob([bom + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
