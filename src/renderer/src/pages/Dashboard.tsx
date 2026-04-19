import React, { useEffect, useState } from 'react'
import type { Page } from '../App'

interface ProjectRow {
  project_id: string
  name: string
  total_cost: number
  total_sessions: number
  cumulative_cache_hit_rate: number
  last_activity: number | null
}

interface DashboardProps {
  onNavigate: (page: Page, projectId?: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.claudeInsight.projects.list().then((rows) => {
      setProjects(rows as ProjectRow[])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>

  if (projects.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>◎</div>
        <h2 style={{ marginBottom: 8 }}>No data yet</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto' }}>
          ClaudeInsight looks for sessions in <code>~/.claude/projects/</code>.
          Make sure Claude Code has been used at least once.
        </p>
      </div>
    )
  }

  const totalCost = projects.reduce((acc, p) => acc + p.total_cost, 0)
  const totalSessions = projects.reduce((acc, p) => acc + p.total_sessions, 0)
  const avgCacheRate =
    projects.reduce((acc, p) => acc + p.cumulative_cache_hit_rate, 0) / projects.length

  return (
    <div>
      <h1 style={{ marginBottom: 'var(--space-lg)', fontSize: 22, fontWeight: 700 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <StatCard label="Total Spend" value={`$${totalCost.toFixed(4)}`} />
        <StatCard label="Sessions" value={String(totalSessions)} />
        <StatCard label="Avg Cache Hit" value={`${(avgCacheRate * 100).toFixed(1)}%`} />
      </div>

      <h2 style={{ marginBottom: 'var(--space-md)', fontSize: 16, fontWeight: 600 }}>
        Projects
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {projects.slice(0, 5).map((p) => (
          <button
            key={p.project_id}
            onClick={() => onNavigate('projects', p.project_id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              textAlign: 'left',
              transition: 'border-color 150ms ease'
            }}
          >
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              ${p.total_cost.toFixed(4)} · {p.total_sessions} sessions
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md) var(--space-lg)'
      }}
    >
      <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
