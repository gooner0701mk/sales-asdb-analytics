import type { Invoice } from './types'

export function normalizeStoredInvoice(x: unknown): Invoice | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.userId !== 'string') return null
  const invoiceDate =
    typeof r.invoiceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.invoiceDate)
      ? r.invoiceDate
      : null
  if (!invoiceDate) return null
  const clientName =
    typeof r.clientName === 'string' ? r.clientName.trim() || '（取引先なし）' : null
  if (!clientName) return null
  const rawAmt = r.amountYen
  const amountYen =
    typeof rawAmt === 'number'
      ? rawAmt
      : Number.parseInt(String(rawAmt ?? ''), 10)
  if (!Number.isFinite(amountYen) || amountYen < 0) return null
  const memo = typeof r.memo === 'string' ? r.memo : ''
  return {
    id: r.id,
    invoiceDate,
    clientName,
    amountYen: Math.round(amountYen),
    userId: r.userId,
    memo,
  }
}
