import type { ChartColorPalette } from './chartColors'

const FALLBACK_STROKES = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#d97706',
  '#059669',
  '#64748b',
  '#b45309',
  '#ea580c',
  '#4f46e5',
]

/** 営業種類 id に対応する折れ線・棒の色（既定4種はパレット固定、それ以外はフォールバック巡回） */
export function colorForActivityTypeId(
  id: string,
  indexInCatalog: number,
  palette: ChartColorPalette,
): string {
  switch (id) {
    case 'coldVisit':
      return palette.coldVisit
    case 'teleAppo':
      return palette.teleAppo
    case 'meeting':
      return palette.meeting
    case 'reception':
      return palette.reception
    default:
      return (
        FALLBACK_STROKES[indexInCatalog % FALLBACK_STROKES.length] ?? '#94a3b8'
      )
  }
}
