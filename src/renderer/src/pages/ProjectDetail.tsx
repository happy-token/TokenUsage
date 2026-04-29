import React, { useEffect, useState } from 'react'
import ProjectReport from './ProjectReport'
import Optimize from './Optimize'
import type { Page } from '../App'
import { useI18n } from '../contexts/I18nContext'

interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  project_path: string | null
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

interface ProjectDetailProps {
  projectId: string | null
  onNavigate: (page: Page, projectId?: string) => void
}

export default function ProjectDetail({ projectId, onNavigate }: ProjectDetailProps): React.ReactElement {
  const { t } = useI18n()
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [overviewOpen, setOverviewOpen] = useState(true)
  const [reportOpen, setReportOpen] = useState(true)
  const [optimizeOpen, setOptimizeOpen] = useState(true)

  function loadProject(id: string): void {
    Promise.all([
      window.tokenUsage.projects.get(id),
      window.tokenUsage.projects.sessions(id, 40)
    ]).then(([proj, sess]) => {
      setProject(proj as ProjectRow)
      setSessions(sess as SessionRow[])
      setLoading(false)
    })
  }

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    setLoading(true)
    setConfirmDelete(false)
    loadProject(projectId)
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    const unsub = window.tokenUsage.onDataUpdated(() => loadProject(projectId))
    return (): void => { unsub() }
  }, [projectId])

  function handleDeleteProject(): void {
    if (!projectId) return
    window.tokenUsage.projects.delete(projectId).then(() => {
      onNavigate('overview')
    })
  }

  if (!projectId || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted)' }}>
        {!projectId ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>←</div>
            <div>{t.selectProject}</div>
          </div>
        ) : t.loading}
      </div>
    )
  }

  if (!project) {
    return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-lg)' }}>{t.projectNotFound}</div>
  }

  const displayName = project.display_name ?? project.name

  return (
    <div>
      {/* Project header */}
      <div style={{ marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{displayName}</h1>
          {project.project_path && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {project.project_path}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t.lastActive}: {project.last_activity ? new Date(project.last_activity).toLocaleString() : '—'}
          </div>
        </div>

        {/* Delete project button */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', background: 'transparent',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 120ms ease'
            }}
          >
            {t.deleteProject}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 200, textAlign: 'right' }}>
              {t.confirmDeleteProject}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
                  background: 'transparent', cursor: 'pointer'
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteProject}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--color-red)',
                  color: 'var(--color-red)', background: 'rgba(248,113,113,0.1)',
                  cursor: 'pointer'
                }}
              >
                {t.delete}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Block: Overview */}
      <CollapsibleBlock title={t.blockOverview} open={overviewOpen} onToggle={() => setOverviewOpen(o => !o)}>
        <ProjectOverview project={project} sessions={sessions} setSessions={setSessions} />
      </CollapsibleBlock>

      {/* Block: Report */}
      <CollapsibleBlock title={t.blockReport} open={reportOpen} onToggle={() => setReportOpen(o => !o)}>
        <ProjectReport projectId={project.project_id} />
      </CollapsibleBlock>

      {/* Block: Optimize */}
      <CollapsibleBlock title={t.blockOptimize} open={optimizeOpen} onToggle={() => setOptimizeOpen(o => !o)}>
        {optimizeOpen && <Optimize projectId={project.project_id} />}
      </CollapsibleBlock>
    </div>
  )
}

function CollapsibleBlock({
  title, open, onToggle, children
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div style={{ marginBottom: 'var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '12px 16px', background: 'var(--color-surface)',
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
          color: 'var(--color-text)', textAlign: 'left', fontSize: 13,
          fontWeight: 700, cursor: 'pointer', transition: 'background 120ms'
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open && (
        <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ProjectOverview({ project, sessions, setSessions }: {
  project: ProjectRow
  sessions: SessionRow[]
  setSessions: React.Dispatch<React.SetStateAction<SessionRow[]>>
}): React.ReactElement {
  const { t } = useI18n()
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null)

  const kpis = [
    { label: t.totalCost, value: `$${project.total_cost.toFixed(4)}`, color: 'var(--color-orange)' },
    { label: t.sessions, value: String(project.total_sessions), color: 'var(--color-blue)' },
    { label: t.cacheHit, value: `${(project.cumulative_cache_hit_rate * 100).toFixed(1)}%`, color: 'var(--color-teal)' },
    {
      label: t.avgCost,
      value: project.total_sessions > 0 ? `$${(project.total_cost / project.total_sessions).toFixed(4)}` : '—',
      color: 'var(--color-yellow)'
    }
  ]

  function handleDeleteSession(sessionId: string): void {
    window.tokenUsage.sessions.delete(sessionId).then(() => {
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
      setConfirmSessionId(null)
    })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 'var(--space-lg)' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--color-border)' }}>
            <div style={{ height: 2, borderRadius: 1, background: k.color, marginBottom: 8 }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
        {t.recentSessions}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '5px 0', fontWeight: 600 }}>{t.time}</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>{t.cost}</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>{t.cache}</th>
            <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600 }}>{t.model}</th>
            <th style={{ textAlign: 'right', padding: '5px 0', fontWeight: 600 }}>{t.duration}</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const cacheRate = s.input_tokens + s.cache_read_tokens > 0
              ? s.cache_read_tokens / (s.input_tokens + s.cache_read_tokens)
              : 0
            const durMin = s.duration_ms ? Math.round(s.duration_ms / 60000) : null
            const isConfirming = confirmSessionId === s.session_id
            return (
              <tr key={s.session_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '7px 0', color: 'var(--color-text-muted)' }}>
                  {new Date(s.start_time).toLocaleString()}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${s.cost_usd.toFixed(4)}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: cacheRate > 0.3 ? 'var(--color-teal)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {(cacheRate * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '7px 8px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {s.model?.replace('claude-', '') ?? '—'}
                </td>
                <td style={{ padding: '7px 0', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {durMin !== null ? `${durMin}m` : '—'}
                </td>
                <td style={{ padding: '7px 0 7px 8px', textAlign: 'right' }}>
                  {!isConfirming ? (
                    <button
                      onClick={() => setConfirmSessionId(s.session_id)}
                      title={t.deleteSession}
                      style={{
                        width: 20, height: 20, borderRadius: 4, fontSize: 10,
                        color: 'var(--color-text-muted)', background: 'transparent',
                        cursor: 'pointer', opacity: 0.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      ✕
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        onClick={() => setConfirmSessionId(null)}
                        style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}
                      >
                        {t.cancel}
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.session_id)}
                        style={{
                          fontSize: 10, color: 'var(--color-red)', background: 'rgba(248,113,113,0.1)',
                          border: '1px solid var(--color-red)', borderRadius: 4,
                          padding: '1px 6px', cursor: 'pointer', fontWeight: 600
                        }}
                      >
                        {t.delete}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t.noSessionsYet}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
