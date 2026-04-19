import React, { useEffect, useState } from 'react'
import type { Page } from '../App'
import { useI18n } from '../contexts/I18nContext'
import AppLogo from './AppLogo'

interface SidebarProps {
  activePage: Page
  selectedProjectId: string | null
  onNavigate: (page: Page, projectId?: string) => void
}

interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  total_cost: number
  total_sessions: number
}

export default function Sidebar({ activePage, selectedProjectId, onNavigate }: SidebarProps): React.ReactElement {
  const { t } = useI18n()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  function loadProjects(): void {
    window.claudeInsight.projects.list().then((rows) => {
      setProjects(rows as ProjectRow[])
    })
  }

  useEffect(() => {
    loadProjects()
    const unsub = window.claudeInsight.onDataUpdated(loadProjects)
    return (): void => { unsub() }
  }, [])

  function handleRefresh(): void {
    setRefreshing(true)
    window.claudeInsight.refresh().finally(() => {
      setTimeout(() => setRefreshing(false), 600)
    })
  }

  return (
    <nav
      style={{
        width: 200,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Logo + refresh */}
      <div style={{ padding: '16px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AppLogo size={22} />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.3px' }}>TokenUsage</span>
        </div>
        <button
          onClick={handleRefresh}
          title={t.refresh}
          style={{
            width: 24, height: 24, borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: refreshing ? 'var(--color-accent)' : 'var(--color-text-muted)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            transition: 'all 200ms ease',
            transform: refreshing ? 'rotate(180deg)' : 'none'
          }}
        >
          ↻
        </button>
      </div>

      {/* Overview nav item */}
      <div style={{ paddingBottom: 8 }}>
        <NavItem
          id="overview"
          label={t.overview}
          icon="⬡"
          active={activePage === 'overview'}
          onClick={() => onNavigate('overview')}
        />
      </div>

      {/* Projects section */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        paddingTop: 10,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--color-text-muted)',
          padding: '0 14px 6px'
        }}>
          {t.projects}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {projects.map((p) => {
            const active = activePage === 'project' && selectedProjectId === p.project_id
            return (
              <button
                key={p.project_id}
                onClick={() => onNavigate('project', p.project_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '7px 14px',
                  width: '100%',
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  textAlign: 'left',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  fontWeight: active ? 600 : 400
                }}
              >
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  color: active ? 'var(--color-text)' : 'inherit'
                }}>
                  {p.display_name ?? p.name}
                </span>
                <span style={{
                  fontSize: 10, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)'
                }}>
                  ${p.total_cost.toFixed(2)}
                </span>
              </button>
            )
          })}
          {projects.length === 0 && (
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.6 }}>
              {t.noProjects}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Settings */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <NavItem
          id="settings"
          label={t.settings}
          icon="⚙"
          active={activePage === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </div>
    </nav>
  )
}

function NavItem({ id, label, icon, active, onClick }: {
  id: string; label: string; icon: string; active: boolean; onClick: () => void
}): React.ReactElement {
  return (
    <button
      key={id}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
        background: active ? 'var(--color-surface-2)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
        fontWeight: active ? 700 : 400,
        fontSize: 13,
        transition: 'all 120ms ease',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer'
      }}
    >
      <span style={{ fontSize: 11, opacity: active ? 1 : 0.6 }}>{icon}</span>
      {label}
    </button>
  )
}
