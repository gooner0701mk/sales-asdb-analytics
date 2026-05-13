import type { Invoice, User } from './types'

export function teamInvoiceTotalYen(invoices: Invoice[]): number {
  return invoices.reduce((s, i) => s + i.amountYen, 0)
}

export type UserInvoiceSummary = {
  userId: string
  displayName: string
  totalYen: number
  count: number
  /** チーム全体売上に占める割合（％） */
  shareOfTeamPercent: number
}

export function summarizeInvoicesByUser(
  invoices: Invoice[],
  users: User[],
): UserInvoiceSummary[] {
  const team = teamInvoiceTotalYen(invoices)
  const byUser = new Map<string, { total: number; count: number }>()
  for (const inv of invoices) {
    const cur = byUser.get(inv.userId) ?? { total: 0, count: 0 }
    cur.total += inv.amountYen
    cur.count += 1
    byUser.set(inv.userId, cur)
  }
  return users.map((u) => {
    const v = byUser.get(u.id) ?? { total: 0, count: 0 }
    return {
      userId: u.id,
      displayName: u.name,
      totalYen: v.total,
      count: v.count,
      shareOfTeamPercent:
        team <= 0 ? 0 : Math.round((v.total / team) * 1000) / 10,
    }
  })
}

export type ClientUserSlice = {
  userId: string
  displayName: string
  amountYen: number
  /** この取引先の請求合計に占める割合（％） */
  shareOfClientPercent: number
}

export type ClientInvoiceRow = {
  clientName: string
  totalYen: number
  byUser: ClientUserSlice[]
}

export function summarizeInvoicesByClient(
  invoices: Invoice[],
  users: User[],
): ClientInvoiceRow[] {
  const nameByUser = new Map(users.map((u) => [u.id, u.name]))
  const byClient = new Map<string, Map<string, number>>()
  for (const inv of invoices) {
    let m = byClient.get(inv.clientName)
    if (!m) {
      m = new Map()
      byClient.set(inv.clientName, m)
    }
    m.set(inv.userId, (m.get(inv.userId) ?? 0) + inv.amountYen)
  }
  const rows: ClientInvoiceRow[] = []
  for (const [clientName, m] of byClient) {
    const totalYen = [...m.values()].reduce((a, b) => a + b, 0)
    const byUser: ClientUserSlice[] = [...m.entries()].map(([userId, amountYen]) => ({
      userId,
      displayName: nameByUser.get(userId) ?? userId,
      amountYen,
      shareOfClientPercent:
        totalYen <= 0 ? 0 : Math.round((amountYen / totalYen) * 1000) / 10,
    }))
    byUser.sort((a, b) => b.amountYen - a.amountYen)
    rows.push({ clientName, totalYen, byUser })
  }
  rows.sort((a, b) => b.totalYen - a.totalYen)
  return rows
}
