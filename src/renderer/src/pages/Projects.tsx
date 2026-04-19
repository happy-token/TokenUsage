import React, { useEffect, useState } from 'react'

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
  duration_ms: number | null
  cost_usd: number
  model: string | null
  cache_read_tokens: number
  input_tokens: number
}

interface ActivityRow {
  activity_type: string
  count: number
  avg_retries: number
  one_shot_count: number
}

interface ProjectsProps {
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
}

export default function Projects({ selectedProjectId, onSelectProject }: ProjectsProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.claudeInsight.projects.list().then((rows) => {
      setProjects(rows as ProjectRow[])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    Promise.all([
      window.claudeInsight.projects.sessions(selectedProjectId, 30),
      window.claudeInsight.projects.activity(selectedProjectId)
    ]).then(([s, a]) => {
      setSessions(s as SessionRow[])
      setActivity(a as ActivityRow[])
    })
  }, [selectedProjectId])

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId)

  if (loading) return <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', gap: 'var(--space-lg)', height: '100%' }}>
      {/* Project list */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-text-muted)' }}>
          PROJECTS
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {projects.map((p) => (
            <button
              key={p.project_id}
              onClick={() => onSelectProject(p.project_id)}
              style={{
                padding: '10px var(--space-md)',
                background: selectedProjectId === p.project_id ? 'var(--color-surface-2)' : 'transparent',
                border: '1px solid',
                borderColor: selectedProjectId === p.project_id ? 'var(--color-accent)' : 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                textAlign: 'left',
                fontSize: 13
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 2 }}>{p.display_name ?? p.name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                ${p.total_cost.toFixed(4)} · {p.total_sessions}s
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Project detail */}
      <div style={{ flex: 1 }}>
        {!selectedProject ? (
          <div style={{ color: 'var(--color-text-muted)', marginTop: 40 }}>Select a project</div>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
              {selectedProject.display_name ?? selectedProject.name}
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
              <Stat label="Total Cost" value={`$${selectedProject.total_cost.toFixed(4)}`} />
              <Stat label="Sessions" value={String(selectedProject.total_sessions)} />
              <Stat
                label="Cache Hit Rate"
                value={`${(selectedProject.cumulative_cache_hit_rate * 100).toFixed(1)}%`}
                note="weighted"
              />
            </div>

            {activity.length > 0 && (
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                  ACTIVITY BREAKDOWN
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  {activity.map((a) => (
                    <div
                      key={a.activity_type}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px',
                        fontSize: 12
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{a.activity_type}</span>
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
              RECENT SESSIONS
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Time</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Cache</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Model</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const cacheRate = s.input_tokens + s.cache_read_tokens > 0
                    ? s.cache_read_tokens / (s.input_tokens + s.cache_read_tokens)
                    : 0
                  return (
                    <tr key={s.session_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 0' }}>{new Date(s.start_time).toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${s.cost_usd.toFixed(4)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: cacheRate > 0.3 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {(cacheRate * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>
                        {s.model ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }): React.ReactElement {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)'
    }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 4 }}>
        {label}{note && <span style={{ marginLeft: 4, opacity: 0.6 }}>({note})</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
