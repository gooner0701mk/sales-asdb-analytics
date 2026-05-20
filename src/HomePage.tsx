import type { PageTab } from './navigation/pageTabs'

type HomeItem = {
  tab: PageTab
  label: string
  description: string
  icon: 'activity' | 'targets' | 'invoices' | 'estimates' | 'attendance' | 'settings'
}

const SALES_ITEMS: HomeItem[] = [
  {
    tab: 'dashboard',
    label: '活動記録・分析',
    description: '活動の登録とグラフ',
    icon: 'activity',
  },
  {
    tab: 'targets',
    label: 'アプローチ先企業一覧',
    description: '見込み先の管理',
    icon: 'targets',
  },
  {
    tab: 'invoices',
    label: '売上データ',
    description: '請求ベースの売上',
    icon: 'invoices',
  },
  {
    tab: 'estimates',
    label: '見積タスク',
    description: '見積の進捗管理',
    icon: 'estimates',
  },
]

function HomeIcon({ kind }: { kind: HomeItem['icon'] }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 32,
    height: 32,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (kind) {
    case 'activity':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-6 4 3 5-7" />
        </svg>
      )
    case 'targets':
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </svg>
      )
    case 'invoices':
      return (
        <svg {...common}>
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    case 'estimates':
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'attendance':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.33 0l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 0-2.33l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 2.33 0l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0 0 2.33l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.33 0l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 0-2.33l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 2.33 0" />
        </svg>
      )
  }
}

function HomeCard({
  item,
  onNavigate,
  large,
}: {
  item: HomeItem
  onNavigate: (tab: PageTab) => void
  large?: boolean
}) {
  return (
    <button
      type="button"
      className={`home-card${large ? ' home-card-large' : ''}`}
      onClick={() => onNavigate(item.tab)}
    >
      <span className="home-card-icon">
        <HomeIcon kind={item.icon} />
      </span>
      <span className="home-card-text">
        <span className="home-card-label">{item.label}</span>
        <span className="home-card-desc">{item.description}</span>
      </span>
    </button>
  )
}

type Props = {
  companyName: string
  onNavigate: (tab: PageTab) => void
}

export function HomePage({ companyName, onNavigate }: Props) {
  return (
    <div className="home-page panel">
      <p className="home-greeting">
        {companyName.trim() ? (
          <>
            <strong>{companyName.trim()}</strong>
            <br />
          </>
        ) : null}
        使う機能を選んでください
      </p>

      <section className="home-section" aria-labelledby="home-sales-heading">
        <h2 id="home-sales-heading" className="home-section-title">
          <span className="home-section-badge">①</span> 営業
        </h2>
        <div className="home-grid home-grid-sales">
          {SALES_ITEMS.map((item) => (
            <HomeCard key={item.tab} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-attendance-heading">
        <h2 id="home-attendance-heading" className="home-section-title">
          <span className="home-section-badge">②</span> 勤怠
        </h2>
        <div className="home-grid home-grid-single">
          <HomeCard
            large
            item={{
              tab: 'attendance',
              label: '勤怠',
              description: '打刻・残業・給与Excel',
              icon: 'attendance',
            }}
            onNavigate={onNavigate}
          />
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-settings-heading">
        <h2 id="home-settings-heading" className="home-section-title">
          <span className="home-section-badge">③</span> 設定
        </h2>
        <div className="home-grid home-grid-single">
          <HomeCard
            large
            item={{
              tab: 'settings',
              label: '設定',
              description: '会社・ユーザー・マスタ',
              icon: 'settings',
            }}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    </div>
  )
}
