import type { PageTab, SalesPageTab } from './navigation/pageTabs'

const ITEMS: { id: SalesPageTab; label: string }[] = [
  { id: 'dashboard', label: '活動記録' },
  { id: 'targets', label: 'アプローチ先' },
  { id: 'invoices', label: '売上' },
  { id: 'estimates', label: '見積' },
]

type Props = {
  active: SalesPageTab
  onSelect: (tab: PageTab) => void
}

export function SalesSubNav({ active, onSelect }: Props) {
  return (
    <nav className="sales-sub-nav" aria-label="営業メニュー">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sales-sub-nav-btn ${active === item.id ? 'active' : ''}`}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
