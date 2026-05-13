import {
  fiscalYearDateRangeIso,
  fiscalYearRangeLabel,
  fyStartYearFromCalendarYm,
} from './fiscalYear'
import type { Invoice } from './types'

export type InvoicePeriodMode = 'month' | 'fiscalYearMarch'

export function invoiceCalendarYm(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function filterInvoicesByCalendarMonth(
  invoices: Invoice[],
  ym: string,
): Invoice[] {
  return invoices.filter((i) => invoiceCalendarYm(i.invoiceDate) === ym)
}

export function filterInvoicesByFiscalYear(
  invoices: Invoice[],
  fyStartYear: number,
  fiscalStartMonth: number,
): Invoice[] {
  const { lo, hiEx } = fiscalYearDateRangeIso(fyStartYear, fiscalStartMonth)
  return invoices.filter((i) => i.invoiceDate >= lo && i.invoiceDate < hiEx)
}

/** @deprecated 互換用。filterInvoicesByFiscalYear(..., 3) と同等 */
export function filterInvoicesByFiscalYearMarch(
  invoices: Invoice[],
  fyStartYear: number,
): Invoice[] {
  return filterInvoicesByFiscalYear(invoices, fyStartYear, 3)
}

export function fiscalYearLabel(
  fyStartYear: number,
  fiscalStartMonth: number,
): string {
  return fiscalYearRangeLabel(fyStartYear, fiscalStartMonth)
}

/** @deprecated 互換 */
export function fiscalYearMarchLabel(fyStartYear: number): string {
  return fiscalYearRangeLabel(fyStartYear, 3)
}

export function uniqueSortedFiscalYearsDesc(
  invoices: Invoice[],
  fiscalStartMonth: number,
): number[] {
  const sm = fiscalStartMonth
  const s = new Set<number>()
  for (const inv of invoices) {
    const ym = invoiceCalendarYm(inv.invoiceDate)
    if (/^\d{4}-\d{2}$/.test(ym)) {
      s.add(fyStartYearFromCalendarYm(ym, sm))
    }
  }
  return [...s].sort((a, b) => b - a)
}
