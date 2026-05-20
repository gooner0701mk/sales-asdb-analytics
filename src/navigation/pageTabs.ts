export type PageTab =
  | 'home'
  | 'dashboard'
  | 'targets'
  | 'invoices'
  | 'estimates'
  | 'attendance'
  | 'settings'

export const SALES_PAGE_TABS = [
  'dashboard',
  'targets',
  'invoices',
  'estimates',
] as const

export type SalesPageTab = (typeof SALES_PAGE_TABS)[number]

export function isSalesPageTab(tab: PageTab): tab is SalesPageTab {
  return (SALES_PAGE_TABS as readonly string[]).includes(tab)
}

export function pageDocumentTitle(tab: PageTab): string {
  switch (tab) {
    case 'home':
      return 'メニュー｜営業データ分析'
    case 'targets':
      return 'アプローチ先企業一覧｜営業データ分析'
    case 'invoices':
      return '売上データ（請求ベース）｜営業データ分析'
    case 'estimates':
      return '見積もりタスク｜営業データ分析'
    case 'attendance':
      return '勤怠｜営業データ分析'
    case 'settings':
      return '設定｜営業データ分析'
    default:
      return '営業データ分析'
  }
}

export function pageBackTitle(tab: PageTab): string {
  switch (tab) {
    case 'dashboard':
      return '活動記録・分析'
    case 'targets':
      return 'アプローチ先企業一覧'
    case 'invoices':
      return '売上データ'
    case 'estimates':
      return '見積タスク'
    case 'attendance':
      return '勤怠'
    case 'settings':
      return '設定'
    default:
      return ''
  }
}
