import { summarizeInvoicesByUser, teamInvoiceTotalYen } from './invoiceMetrics'
import type { Invoice, User } from './types'

export type ClientCompanyShareRow = {
  clientName: string
  totalYen: number
  /** 表示スコープ内の請求合計に占める割合（％） */
  shareOfScopePercent: number
}

export function topClientSharesByScopeRevenue(
  invoices: Invoice[],
  topN: number,
): ClientCompanyShareRow[] {
  const scopeTotal = teamInvoiceTotalYen(invoices)
  const byClient = new Map<string, number>()
  for (const inv of invoices) {
    byClient.set(inv.clientName, (byClient.get(inv.clientName) ?? 0) + inv.amountYen)
  }
  return [...byClient.entries()]
    .map(([clientName, totalYen]) => ({
      clientName,
      totalYen,
      shareOfScopePercent:
        scopeTotal <= 0 ? 0 : Math.round((totalYen / scopeTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.totalYen - a.totalYen)
    .slice(0, topN)
}

export type UserClientPieSlice = {
  name: string
  value: number
  /** 当該担当の期間内請求合計に占める割合（％） */
  shareOfUserPercent: number
}

/**
 * 担当の請求を取引先別に集計し、金額上位 topN 件をスライス化。
 * 残りは「その他」にまとめる（円グラフ用）。
 */
export function userTopClientPieSlices(
  userId: string,
  invoices: Invoice[],
  topN: number,
): UserClientPieSlice[] {
  const mine = invoices.filter((i) => i.userId === userId)
  const userTotal = teamInvoiceTotalYen(mine)
  const byClient = new Map<string, number>()
  for (const inv of mine) {
    byClient.set(inv.clientName, (byClient.get(inv.clientName) ?? 0) + inv.amountYen)
  }
  const sorted = [...byClient.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN).reduce((s, [, v]) => s + v, 0)
  const pct = (v: number) =>
    userTotal <= 0 ? 0 : Math.round((v / userTotal) * 1000) / 10
  const out: UserClientPieSlice[] = top.map(([name, value]) => ({
    name,
    value,
    shareOfUserPercent: pct(value),
  }))
  if (rest > 0) {
    out.push({ name: 'その他', value: rest, shareOfUserPercent: pct(rest) })
  }
  return out
}

/** 請求額の多い順（0円は除外） */
export function rankedUsersByInvoiceTotal(invoices: Invoice[], users: User[]) {
  return summarizeInvoicesByUser(invoices, users)
    .filter((r) => r.totalYen > 0)
    .sort((a, b) => b.totalYen - a.totalYen)
}
