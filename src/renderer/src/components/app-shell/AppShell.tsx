
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode, ReactElement } from 'react'
import './app-shell.css'

type AppShellProps = {
  activeMenu: string
  onMenuSelect: (menu: string) => void
  onQuit: () => void
  children: ReactNode
}

const menuGroups = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '▣' },
      { id: 'billing', label: 'Billing F1', icon: '▤' },
      { id: 'history', label: 'Bill History F2', icon: '▥' },
      { id: 'items', label: 'Items F3', icon: '□' }
    ]
  },
  {
    title: 'INVENTORY',
    items: [
      { id: 'purchase', label: 'Purchase F4', icon: '＋' },
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
    items: [{ id: 'settings', label: 'Settings', icon: '⚙' }]
  }
]

export function AppShell({
  activeMenu,
  onMenuSelect,
  onQuit,
  children
}: AppShellProps): ReactElement {
  const menuItems = useMemo(() => menuGroups.flatMap((group) => group.items), [])

  /*
   * This is separate from activeMenu.
   *
   * activeMenu:
   *   The screen currently open.
   *
   * keyboardSelectedMenu:
   *   The item currently highlighted by ↑ / ↓.
   *
   * This prevents ↓ from immediately opening the next screen.
   */
  const [keyboardSelectedMenu, setKeyboardSelectedMenu] = useState(activeMenu)

  /*
   * Whenever the application opens a screen through mouse click,
   * F-key, or another action, keep keyboard navigation synchronized
   * with that screen.
   */
  useEffect(() => {
    setKeyboardSelectedMenu(activeMenu)
  }, [activeMenu])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      /*
       * Do not intercept keyboard navigation while typing
       * inside an input, textarea, select, or contenteditable element.
       */
      const target = event.target

      if (target instanceof HTMLElement) {
        const tagName = target.tagName

        const isTypingElement =
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable

        if (isTypingElement) {
          return
        }
      }

      if (menuItems.length === 0) {
        return
      }

      const currentIndex = menuItems.findIndex(
        (item) => item.id === keyboardSelectedMenu
      )

      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0

      /*
       * ARROW DOWN
       *
       * Only move the keyboard highlight.
       * DO NOT open the screen.
       */
      if (event.key === 'ArrowDown') {
        event.preventDefault()

        const nextIndex = Math.min(
          safeCurrentIndex + 1,
          menuItems.length - 1
        )

        const nextItem = menuItems[nextIndex]

        if (nextItem) {
          setKeyboardSelectedMenu(nextItem.id)
        }

        return
      }

      /*
       * ARROW UP
       *
       * Only move the keyboard highlight.
       * DO NOT open the screen.
       */
      if (event.key === 'ArrowUp') {
        event.preventDefault()

        const previousIndex = Math.max(
          safeCurrentIndex - 1,
          0
        )

        const previousItem = menuItems[previousIndex]

        if (previousItem) {
          setKeyboardSelectedMenu(previousItem.id)
        }

        return
      }

      /*
       * ENTER
       *
       * Open the currently highlighted menu item.
       */
      if (event.key === 'Enter') {
        event.preventDefault()

        onMenuSelect(keyboardSelectedMenu)

        return
      }

      /*
       * HOME
       *
       * Move highlight to Dashboard.
       * Do not open it.
       */
      if (event.key === 'Home') {
        event.preventDefault()

        const firstItem = menuItems[0]

        if (firstItem) {
          setKeyboardSelectedMenu(firstItem.id)
        }

        return
      }

      /*
       * END
       *
       * Move highlight to Settings.
       * Do not open it.
       */
      if (event.key === 'End') {
        event.preventDefault()

        const lastItem = menuItems[menuItems.length - 1]

        if (lastItem) {
          setKeyboardSelectedMenu(lastItem.id)
        }

        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [keyboardSelectedMenu, menuItems, onMenuSelect])

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
              <div className="sidebar-group-title">
                {group.title}
              </div>

              {group.items.map((item) => {
                const isActive = activeMenu === item.id
                const isKeyboardSelected =
                  keyboardSelectedMenu === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      'sidebar-item',
                      isActive ? 'active' : '',
                      isKeyboardSelected ? 'keyboard-selected' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setKeyboardSelectedMenu(item.id)
                      onMenuSelect(item.id)
                    }}
                  >
                    <span className="sidebar-item-icon">
                      {item.icon}
                    </span>

                    <span className="sidebar-item-label">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}

          <button
            type="button"
            className="sidebar-item sidebar-item-quit"
            onClick={onQuit}
          >
            <span className="sidebar-item-icon">⏻</span>

            <span className="sidebar-item-label">
              Quit Application
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-name">
            Kirana Mart POS
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-title">
            {menuItems.find(
              (item) => item.id === activeMenu
            )?.label ?? 'Dashboard'}
          </div>

          <div className="app-topbar-right">
            <span className="app-date">
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>

            <span className="app-user">
              Admin
            </span>
          </div>
        </header>

        <section className="app-content">
          {children}
        </section>
      </main>
    </div>
  )
}
