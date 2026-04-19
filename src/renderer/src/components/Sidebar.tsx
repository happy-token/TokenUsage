import React from 'react'
import type { Page } from '../App'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'projects', label: 'Projects', icon: '◈' },
  { id: 'sessions', label: 'Sessions', icon: '◎' },
  { id: 'optimize', label: 'Optimize', icon: '⚡' },
  { id: 'insights', label: 'Insights', icon: '◆' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export default function Sidebar({ activePage, onNavigate }: SidebarProps): React.ReactElement {
  return (
    <nav
      style={{
        width: 200,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-md) 0',
        flexShrink: 0
      }}
    >
      <div style={{ padding: '0 var(--space-md) var(--space-lg)' }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
          ClaudeInsight
        </span>
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: '10px var(--space-md)',
            color: activePage === item.id ? 'var(--color-text)' : 'var(--color-text-muted)',
            background: activePage === item.id ? 'var(--color-surface-2)' : 'transparent',
            borderLeft: activePage === item.id
              ? '2px solid var(--color-accent)'
              : '2px solid transparent',
            fontWeight: activePage === item.id ? 600 : 400,
            transition: 'all 150ms ease',
            textAlign: 'left',
            width: '100%'
          }}
        >
          <span style={{ fontSize: 12 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
