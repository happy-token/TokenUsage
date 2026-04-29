import React, { useEffect, useState } from 'react'

interface SessionRow {
  session_id: string
  start_time: number
  duration_ms: number | null
  cost_usd: number
  model: string | null
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

interface ActivityRow {
  session_id: string
  activity_type: string
  retry_count: number
  one_shot_success: number
  top_shell_commands: string
  shell_command_count: number
}

const ACTIVITY_COLOR: Record<string, string> = {
  feature: '#f0b429',
  debugging: '#ef4444',
  refactoring: '#f59e0b',
  testing: '#22c55e',
  git: '#38bdf8',
  'build-deploy': '#a78bfa',
  exploration: '#94a3b8',
  planning: '#84cc16',
  brainstorming: '#fb7185',
  conversation: '#cbd5e1'
}

interface SessionsProps {
  projectId: string | null
}

export default function Sessions({ projectId }: SessionsProps): React.ReactElement {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [activities, setActivities] = useState<Map<string, ActivityRow>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    window.claudeInsight.projects.sessions(projectId, 50).then(async (rows) => {
      const sessionRows = rows as SessionRow[]
      setSessions(sessionRows)

      const actMap = new Map<string, ActivityRow>()
      for (const s of sessionRows) {
        const a = await window.claudeInsight.sessions.activity(s.session_id)
        if (a) actMap.set(s.session_id, a as ActivityRow)
      }
      setActivities(actMap)
      setLoading(false)
    })
  }, [projectId])

  if (!projectId) {
    return <div style={{ color: 'var(--color-text-muted)', marginTop: 40 }}>Select a project from Projects page.</div>
  }

  if (loading) return <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>

  const selectedSession = sessions.find((s) => s.session_id === selected)
  const selectedActivity = selected ? activities.get(selected) : undefined

  function formatDuration(ms: number | null): string {
    if (!ms) return '—'
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-lg)', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Sessions</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Time</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Type</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Cost</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Duration</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Cache</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const act = activities.get(s.session_id)
              const cacheRate = s.input_tokens + s.cache_read_tokens > 0
                ? s.cache_read_tokens / (s.input_tokens + s.cache_read_tokens)
                : 0
              return (
                <tr
                  key={s.session_id}
                  onClick={() => setSelected(s.session_id === selected ? null : s.session_id)}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    background: selected === s.session_id ? 'var(--color-surface-2)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '8px 0' }}>{new Date(s.start_time).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>
                    {act ? (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: `${ACTIVITY_COLOR[act.activity_type] ?? '#94a3b8'}22`,
                        color: ACTIVITY_COLOR[act.activity_type] ?? '#94a3b8',
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {act.activity_type}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${s.cost_usd.toFixed(4)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {formatDuration(s.duration_ms)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: cacheRate > 0.3 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {(cacheRate * 100).toFixed(0)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedSession && (
        <div style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          alignSelf: 'flex-start'
        }}>
          <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-md)', fontSize: 14 }}>Session Detail</h3>
          <DetailRow label="Tokens in" value={selectedSession.input_tokens.toLocaleString()} />
          <DetailRow label="Tokens out" value={selectedSession.output_tokens.toLocaleString()} />
          <DetailRow label="Cache read" value={selectedSession.cache_read_tokens.toLocaleString()} />
          <DetailRow label="Cache write" value={selectedSession.cache_write_tokens.toLocaleString()} />
          <DetailRow label="Model" value={selectedSession.model ?? '—'} />
          {selectedActivity && (
            <>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0' }} />
              <DetailRow label="Activity" value={selectedActivity.activity_type} />
              <DetailRow label="Retries" value={String(selectedActivity.retry_count)} />
              <DetailRow label="Shell cmds" value={String(selectedActivity.shell_command_count)} />
              {selectedActivity.shell_command_count > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>TOP COMMANDS</div>
                  {(JSON.parse(selectedActivity.top_shell_commands || '[]') as string[]).map((cmd, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', padding: '2px 0' }}>
                      {cmd}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}
