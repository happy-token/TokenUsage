import React, { useEffect, useState } from 'react'
import { useI18n } from '../contexts/I18nContext'

type Period = 1 | 7 | 30 | 0

interface ProjectReportProps {
  projectId: string
}

// ─── Data shapes ────────────────────────────────────────────────────────────

interface SummaryData {
  costAnalysis: {
    topSessions: Array<{ session_id: string; start_time: number; cost_usd: number; model: string | null }>
    totalCost: number; avgCost: number; sessionCount: number
  }
  tokenBreakdown: { input: number; output: number; cacheRead: number; cacheWrite: number }
  cacheStats: { hitRate: number; grossSavings: number; writeCost: number; netRoi: number }
  activityBreakdown: {
    byType: Array<{ activity_type: string; count: number; avg_retries: number; one_shot_count: number; cost: number }>
    avgRetries: number; oneShotRate: number
  }
  modelBreakdown: { models: Array<{ model: string; session_count: number; total_cost: number; input_tokens: number; output_tokens: number }> }
  toolStats: { topTools: Array<{ name: string; count: number }> }
  shellStats: { byCategory: Record<string, number>; topCommands: Array<{ cmd: string; count: number }> }
  mcpStats: { servers: Array<{ name: string; count: number }> }
}

// ─── Root component ──────────────────────────────────────────────────────────

export default function ProjectReport({ projectId }: ProjectReportProps): React.ReactElement {
  const { t } = useI18n()
  const PERIOD_LABELS: Record<Period, string> = { 1: t.today, 7: t.days7, 30: t.days30, 0: t.allTime }
  const [period, setPeriod] = useState<Period>(30)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SummaryData | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    window.claudeInsight.projects.report(projectId, period)
      .then(r => { setData(r as SummaryData); setLoading(false) })
  }, [projectId, period])

  return (
    <div>
      {/* Period filter */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([1, 7, 30, 0] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 10px',
                borderRadius: 16,
                border: '1px solid',
                borderColor: period === p ? 'var(--color-orange)' : 'var(--color-border)',
                background: period === p ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                color: period === p ? 'var(--color-orange)' : 'var(--color-text-muted)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton rows={3} /> : data && <SummaryView data={data} t={t} />}
    </div>
  )
}

// ─── Summary (original "all" view) ───────────────────────────────────────────

function SummaryView({ data, t }: { data: SummaryData; t: ReturnType<typeof useI18n>['t'] }): React.ReactElement {
  const { costAnalysis, tokenBreakdown, cacheStats, activityBreakdown, modelBreakdown, toolStats, shellStats, mcpStats } = data
  const totalTokens = tokenBreakdown.input + tokenBreakdown.output + tokenBreakdown.cacheRead + tokenBreakdown.cacheWrite
  const maxSessionCost = Math.max(...costAnalysis.topSessions.map(s => s.cost_usd), 0.0001)
  const maxActivityCount = Math.max(...activityBreakdown.byType.map(a => a.count), 1)
  const maxModelCost = Math.max(...modelBreakdown.models.map(m => m.total_cost), 0.0001)

  const ACTIVITY_COLORS: Record<string, string> = {
    feature: 'var(--color-blue)', debugging: 'var(--color-red)', testing: 'var(--color-teal)',
    refactoring: 'var(--color-purple)', planning: 'var(--color-yellow)', git: 'var(--color-orange)',
    'build-deploy': 'var(--color-pink)', conversation: 'var(--color-green)',
    exploration: 'var(--color-info)', brainstorming: 'var(--color-accent)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Panel accent="var(--color-orange)" title={t.costAnalysis}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <KpiMini label={t.total} value={`$${costAnalysis.totalCost.toFixed(4)}`} />
            <KpiMini label={t.avgCost} value={`$${costAnalysis.avgCost.toFixed(4)}`} />
            <KpiMini label={t.sessions} value={String(costAnalysis.sessionCount)} />
          </div>
          <Label>{t.topSessions}</Label>
          {costAnalysis.topSessions.slice(0, 6).map(s => (
            <BarRow key={s.session_id} label={new Date(s.start_time).toLocaleDateString()} value={s.cost_usd} max={maxSessionCost} color="var(--color-orange)" suffix={`$${s.cost_usd.toFixed(4)}`} />
          ))}
        </Panel>

        <Panel accent="var(--color-blue)" title={t.tokenBreakdown}>
          <TokenBar
            segments={[
              { label: t.input, value: tokenBreakdown.input, color: 'var(--color-blue)' },
              { label: t.output, value: tokenBreakdown.output, color: 'var(--color-purple)' },
              { label: t.cacheRead, value: tokenBreakdown.cacheRead, color: 'var(--color-teal)' },
              { label: t.cacheWrite, value: tokenBreakdown.cacheWrite, color: 'var(--color-yellow)' }
            ]}
            total={totalTokens}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <CacheGauge rate={cacheStats.hitRate} />
            <div>
              <Label>{t.cacheRoi}</Label>
              <RoiRow label={t.grossSavings} value={`$${cacheStats.grossSavings.toFixed(4)}`} positive />
              <RoiRow label={t.writeCost} value={`-$${cacheStats.writeCost.toFixed(4)}`} />
              <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 0' }} />
              <RoiRow label={t.netRoi} value={`$${cacheStats.netRoi.toFixed(4)}`} positive={cacheStats.netRoi >= 0} bold />
            </div>
          </div>
        </Panel>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Panel accent="var(--color-teal)" title={t.byActivity2}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <KpiMini label={t.avgRetries} value={activityBreakdown.avgRetries.toFixed(1)} />
            <KpiMini label={t.oneShotRate} value={`${(activityBreakdown.oneShotRate * 100).toFixed(0)}%`} />
          </div>
          {activityBreakdown.byType.map(a => (
            <BarRow key={a.activity_type} label={a.activity_type} value={a.count} max={maxActivityCount} color={ACTIVITY_COLORS[a.activity_type] ?? 'var(--color-text-muted)'} suffix={String(a.count)} dot />
          ))}
          {activityBreakdown.byType.length === 0 && <Empty text={t.noData} />}
        </Panel>

        <Panel accent="var(--color-purple)" title={t.byModel}>
          {modelBreakdown.models.map(m => (
            <BarRow key={m.model} label={m.model} value={m.total_cost} max={maxModelCost} color="var(--color-purple)" suffix={`$${m.total_cost.toFixed(4)}`} sub={`${m.session_count} sess`} />
          ))}
          {modelBreakdown.models.length === 0 && <Empty text={t.noData} />}
        </Panel>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Panel accent="var(--color-yellow)" title={t.coreTools}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {toolStats.topTools.filter(t => !t.name.includes('__') && !t.name.startsWith('mcp_')).slice(0, 12).map(t => (
              <div key={t.name} style={{ background: 'var(--color-surface-2)', borderRadius: 5, padding: '5px 7px' }}>
                <div style={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-yellow)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.count.toLocaleString()}</div>
              </div>
            ))}
            {toolStats.topTools.filter(t => !t.name.includes('__')).length === 0 && <div style={{ gridColumn: '1/-1' }}><Empty text={t.noData} /></div>}
          </div>
        </Panel>

        <Panel accent="var(--color-pink)" title={t.shellCommands}>
          <Label>{t.byCategory}</Label>
          {Object.entries(shellStats.byCategory).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => {
            const total = Object.values(shellStats.byCategory).reduce((a, b) => a + b, 0)
            return <BarRow key={cat} label={cat} value={cnt} max={total} color="var(--color-pink)" suffix={String(cnt)} />
          })}
          <Label style={{ marginTop: 10 }}>{t.topCommands}</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {shellStats.topCommands.slice(0, 10).map(c => (
              <span key={c.cmd} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 3, padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                {c.cmd} <strong style={{ color: 'var(--color-pink)' }}>{c.count}</strong>
              </span>
            ))}
            {shellStats.topCommands.length === 0 && <Empty text={t.noData} />}
          </div>
        </Panel>
      </div>

      {/* Row 4 — MCP */}
      <Panel accent="var(--color-green)" title={t.mcpServers}>
        {mcpStats.servers.length === 0 ? <Empty text={t.noMcpUsage} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {mcpStats.servers.map(s => (
              <div key={s.name} style={{ background: 'var(--color-surface-2)', borderRadius: 7, padding: '7px 9px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-green)', fontVariantNumeric: 'tabular-nums' }}>{s.count.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{t.calls}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

function Panel({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 'var(--space-md)', border: '1px solid var(--color-border)' }}>
      <div style={{ height: 2, borderRadius: 1, background: accent, marginBottom: 12 }} />
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ height: 2, borderRadius: 1, background: color, marginBottom: 8 }} />
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function KpiMini({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 6, ...style }}>{children}</div>
  )
}

function BarRow({ label, value, max, color, suffix, sub, dot }: {
  label: string; value: number; max: number; color: string; suffix: string; sub?: string; dot?: boolean
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
      {dot && <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 11, width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{suffix}</span>
      {sub && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', minWidth: 40 }}>{sub}</span>}
    </div>
  )
}

function TokenBar({ segments, total }: { segments: Array<{ label: string; value: number; color: string }>; total: number }): React.ReactElement {
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1, marginBottom: 7 }}>
        {segments.map(s => (
          <div key={s.label} style={{ flex: total > 0 ? s.value / total : 0, background: s.color, minWidth: s.value > 0 ? 3 : 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{s.label}</span>
            <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtTok(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CacheGauge({ rate }: { rate: number }): React.ReactElement {
  const color = rate > 0.5 ? 'var(--color-teal)' : rate > 0.2 ? 'var(--color-yellow)' : 'var(--color-red)'
  const pct = Math.round(rate * 100)
  return (
    <div style={{ textAlign: 'center' }}>
      <Label>Cache hit rate</Label>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg width={70} height={36} viewBox="0 0 70 36">
          <path d="M 5 35 A 30 30 0 0 1 65 35" fill="none" stroke="var(--color-surface-2)" strokeWidth={6} strokeLinecap="round" />
          <path d="M 5 35 A 30 30 0 0 1 65 35" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 94} 94`} />
        </svg>
        <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', fontSize: 14, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
      </div>
    </div>
  )
}

function CacheChip({ rate }: { rate: number }): React.ReactElement {
  const color = rate > 0.5 ? 'var(--color-teal)' : rate > 0.2 ? 'var(--color-yellow)' : 'var(--color-text-muted)'
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 600 }}>{(rate * 100).toFixed(0)}%</span>
}

function RoiRow({ label, value, positive, bold }: { label: string; value: string; positive?: boolean; bold?: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: positive ? 'var(--color-teal)' : 'var(--color-text-muted)', fontWeight: bold ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function DataTable({ cols, rows }: { cols: string[]; rows: Array<Array<React.ReactNode>> }): React.ReactElement {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '7px 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ text }: { text?: string }): React.ReactElement {
  return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{text ?? 'No data'}</span>
}

function EmptyState({ text }: { text: string }): React.ReactElement {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>○</div>
      {text}
    </div>
  )
}

function Skeleton({ rows }: { rows: number }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div style={{ height: 180, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
          <div style={{ height: 180, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
        </div>
      ))}
    </div>
  )
}

function fmtTok(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}
