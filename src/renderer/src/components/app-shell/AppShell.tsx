import type { ReactNode } from 'react'
import './app-shell.css'

type AppShellProps = {
  activeMenu: string
  onMenuSelect: (menu: string) => void
  children: ReactNode
}

const menuGroups = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '▣' },
      { id: 'billing', label: 'Billing F1', icon: '▤' },
      { id: 'history', label: 'Bill History F2', icon: '▥' },
      { id: 'items', label: 'Items F3', icon: '□' },
      { id: 'returns', label: 'Returns', icon: '↩' }
    ]
  },
  {
    title: 'INVENTORY',
    items: [
      { id: 'purchase', label: 'Purchase', icon: '＋' },
      { id: 'stock', label: 'Stock', icon: '▦' },
      { id: 'low-stock', label: 'Low Stock', icon: '!' }
    ]
  },
  {
    title: 'REPORTS',
    items: [
      { id: 'sales-report', label: 'Sales Reports', icon: '▥' },
      { id: 'profit-report', label: 'Profit Reports', icon: '₹' }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', icon: '⚙' },
      { id: 'backup', label: 'Backup & Restore', icon: '⇅' }
    ]
  }
]

export function AppShell({ activeMenu, onMenuSelect, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-title">KIRANA</div>
          <div className="sidebar-brand-subtitle">MART POS</div>
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group) => (
            <div className="sidebar-group" key={group.title}>
              <div className="sidebar-group-title">{group.title}</div>

              {group.items.map((item) => {
                const isActive = activeMenu === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => onMenuSelect(item.id)}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>

                    <span className="sidebar-item-label">{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-name">Kirana Mart POS</div>
          <div className="sidebar-footer-version">Version 0.1.0</div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-title">
            {menuGroups.flatMap((group) => group.items).find((item) => item.id === activeMenu)
              ?.label ?? 'Dashboard'}
          </div>

          <div className="app-topbar-right">
            <span className="app-date">
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>

            <span className="app-user">Admin</span>
          </div>
        </header>

        <section className="app-content">{children}</section>
      </main>
    </div>
  )
}
