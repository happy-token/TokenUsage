import React, { useEffect, useState } from 'react'
import type { Page } from '../App'

interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  total_cost: number
  total_sessions: number
  cumulative_cache_hit_rate: number
  last_activity: number | null
}

interface DashboardProps {
  onNavigate: (page: Page, projectId?: string) => void
}

const KPI_COLORS = ['var(--color-orange)', 'var(--color-blue)', 'var(--color-teal)', 'var(--color-yellow)']

export default function Dashboard({ onNavigate }: DashboardProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.tokenUsage.projects.list().then((rows) => {
      setProjects(rows as ProjectRow[])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)' }}>
        <div style={{ height: 28, width: 140, background: 'var(--color-surface-2)', borderRadius: 6, marginBottom: 24, animation: 'pulse 1.5s ease infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 90, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
        <h2 style={{ marginBottom: 8, fontSize: 18 }}>No data yet</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
          TokenUsage looks for sessions in <code style={{ background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 4 }}>~/.claude/projects/</code>.
          Start using Claude Code and data will appear here.
        </p>
      </div>
    )
  }

  const totalCost = projects.reduce((acc, p) => acc + p.total_cost, 0)
  const totalSessions = projects.reduce((acc, p) => acc + p.total_sessions, 0)
  const totalCacheRead = 0 // not stored on project row — shown via weighted rate
  const avgCacheRate = (() => {
    // weighted mean from cumulative_cache_hit_rate × total_sessions
    const num = projects.reduce((acc, p) => acc + p.cumulative_cache_hit_rate * p.total_sessions, 0)
    const den = totalSessions
    return den > 0 ? num / den : 0
  })()
  const topProject = projects[0]

  const kpis = [
    { label: 'Total Spend', value: `$${totalCost.toFixed(2)}`, sub: `across ${projects.length} projects` },
    { label: 'Sessions', value: String(totalSessions), sub: `avg $${totalSessions > 0 ? (totalCost / totalSessions).toFixed(3) : '0'}/session` },
    { label: 'Cache Hit Rate', value: `${(avgCacheRate * 100).toFixed(1)}%`, sub: 'weighted average' },
    { label: 'Top Project', value: topProject?.display_name ?? topProject?.name ?? '—', sub: `$${topProject?.total_cost.toFixed(2) ?? '0'}` }
  ]

  // Bar chart: top 8 projects by cost
  const chartProjects = [...projects].sort((a, b) => b.total_cost - a.total_cost).slice(0, 8)
  const maxCost = Math.max(...chartProjects.map(p => p.total_cost), 0.0001)

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Overview</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 2 }}>All-time across all projects</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 'var(--space-xl)' }}>
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} color={KPI_COLORS[i]} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        {/* Project cost bar chart */}
        <Panel title="Top Projects by Cost">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chartProjects.map((p, i) => (
              <button
                key={p.project_id}
                onClick={() => onNavigate('project', p.project_id)}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{p.display_name ?? p.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>${p.total_cost.toFixed(2)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(p.total_cost / maxCost) * 100}%`,
                    background: `hsl(${(i * 47) % 360}, 85%, 65%)`,
                    borderRadius: 2,
                    transition: 'width 400ms ease'
                  }} />
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* Recent project activity */}
        <Panel title="Recent Projects">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.slice(0, 7).map((p) => (
              <button
                key={p.project_id}
                onClick={() => onNavigate('project', p.project_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 7,
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'border-color 120ms'
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 12 }}>{p.display_name ?? p.name}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <CacheBar rate={p.cumulative_cache_hit_rate} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    ${p.total_cost.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {p.total_sessions}s
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ height: 2, borderRadius: 1, background: color, marginBottom: 10 }} />
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 'var(--space-md)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function CacheBar({ rate }: { rate: number }): React.ReactElement {
  const color = rate > 0.5 ? 'var(--color-teal)' : rate > 0.2 ? 'var(--color-yellow)' : 'var(--color-text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 28, height: 3, background: 'var(--color-surface)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate * 100}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, fontVariantNumeric: 'tabular-nums' }}>{(rate * 100).toFixed(0)}%</span>
    </div>
  )
}
