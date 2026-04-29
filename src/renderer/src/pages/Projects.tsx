import React, { useEffect, useState } from 'react'
import ProjectReport from './ProjectReport'
import Optimize from './Optimize'

interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  total_cost: number
  total_sessions: number
  cumulative_cache_hit_rate: number
  last_activity: number | null
}

interface SessionRow {
  session_id: string
  start_time: number
  end_time: number | null
  duration_ms: number | null
  cost_usd: number
  model: string | null
  cache_read_tokens: number
  input_tokens: number
}

type Tab = 'overview' | 'report' | 'optimize'

interface ProjectsProps {
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'report', label: 'Report' },
  { id: 'optimize', label: 'Optimize' }
]

export default function Projects({ selectedProjectId, onSelectProject }: ProjectsProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    window.tokenUsage.projects.list().then((rows) => {
      setProjects(rows as ProjectRow[])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    setSessions([])
    window.tokenUsage.projects.sessions(selectedProjectId, 40).then((s) => {
      setSessions(s as SessionRow[])
    })
    setTab('overview')
  }, [selectedProjectId])

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId)

  if (loading) return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-md)' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', gap: 'var(--space-md)', height: '100%' }}>
      {/* Project list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Projects
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {projects.map((p) => {
            const active = selectedProjectId === p.project_id
            return (
              <button
                key={p.project_id}
                onClick={() => onSelectProject(p.project_id)}
                style={{
                  padding: '9px 10px',
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? 'var(--color-orange)' : 'transparent',
                  borderRadius: 7,
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'border-color 120ms, background 120ms'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.display_name ?? p.name}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 10, display: 'flex', gap: 8 }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>${p.total_cost.toFixed(2)}</span>
                  <span>{p.total_sessions}s</span>
                  <span>{(p.cumulative_cache_hit_rate * 100).toFixed(0)}% cache</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Project detail */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!selectedProject ? (
          <div style={{ color: 'var(--color-text-muted)', marginTop: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>←</div>
            Select a project
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>
                {selectedProject.display_name ?? selectedProject.name}
              </h1>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                Last active: {selectedProject.last_activity ? new Date(selectedProject.last_activity).toLocaleString() : '—'}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '7px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: tab === t.id ? '2px solid var(--color-orange)' : '2px solid transparent',
                    color: tab === t.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontSize: 13,
                    fontWeight: tab === t.id ? 700 : 400,
                    cursor: 'pointer',
                    marginBottom: -1,
                    transition: 'color 120ms'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <ProjectOverview project={selectedProject} sessions={sessions} />
            )}
            {tab === 'report' && (
              <ProjectReport projectId={selectedProject.project_id} />
            )}
            {tab === 'optimize' && (
              <Optimize projectId={selectedProject.project_id} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ProjectOverview({ project, sessions }: { project: ProjectRow; sessions: SessionRow[] }): React.ReactElement {
  const kpis = [
    { label: 'Total Cost', value: `$${project.total_cost.toFixed(4)}`, color: 'var(--color-orange)' },
    { label: 'Sessions', value: String(project.total_sessions), color: 'var(--color-blue)' },
    { label: 'Cache Hit Rate', value: `${(project.cumulative_cache_hit_rate * 100).toFixed(1)}%`, color: 'var(--color-teal)' },
    {
      label: 'Avg Cost/Session',
      value: project.total_sessions > 0 ? `$${(project.total_cost / project.total_sessions).toFixed(4)}` : '—',
      color: 'var(--color-yellow)'
    }
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 'var(--space-lg)' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ height: 2, borderRadius: 1, background: k.color, marginBottom: 8 }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
        Recent Sessions
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '5px 0', fontWeight: 600 }}>Time</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>Cost</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>Cache</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600 }}>Model</th>
            <th style={{ textAlign: 'right', padding: '5px 0', fontWeight: 600 }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const cacheRate = s.input_tokens + s.cache_read_tokens > 0
              ? s.cache_read_tokens / (s.input_tokens + s.cache_read_tokens)
              : 0
            const durMin = s.duration_ms ? Math.round(s.duration_ms / 60000) : null
            return (
              <tr key={s.session_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '7px 0', color: 'var(--color-text-muted)' }}>
                  {new Date(s.start_time).toLocaleString()}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${s.cost_usd.toFixed(4)}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: cacheRate > 0.3 ? 'var(--color-teal)' : 'var(--color-text-muted)' }}>
                  {(cacheRate * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '7px 8px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {s.model ?? '—'}
                </td>
                <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {durMin !== null ? `${durMin}m` : '—'}
                </td>
              </tr>
            )
          })}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>No sessions yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
