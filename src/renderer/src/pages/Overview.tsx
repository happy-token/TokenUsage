import React, { useEffect, useState } from 'react'
import type { Page } from '../App'
import { useI18n } from '../contexts/I18nContext'

type Period = 1 | 7 | 30 | 0

// Maps our internal activity_type keys → display labels (mirrors codeburn CATEGORY_LABELS)
const ACTIVITY_LABELS: Record<string, string> = {
  feature:      'Feature Dev',
  debugging:    'Debugging',
  refactoring:  'Refactoring',
  testing:      'Testing',
  git:          'Git Ops',
  'build-deploy': 'Build/Deploy',
  exploration:  'Exploration',
  planning:     'Planning',
  brainstorming:'Brainstorming',
  conversation: 'Conversation',
  general:      'General',
}

interface ProjectRow {
  project_id: string
  name: string
  display_name: string | null
  total_cost: number
  session_count: number
  total_sessions: number
  avg_cost: number
  cacheHitRate: number
  sharePct: number
  last_active: number | null
  cumulative_cache_hit_rate?: number
  last_activity?: number | null
}

interface DayRow {
  day: string
  session_count: number
  cost: number
  cacheHitRate: number
}

interface ModelRow {
  model: string
  session_count: number
  total_cost: number
  cacheHitRate: number
}

interface ActivityRow {
  activity_type: string
  count: number
  avg_retries: number
  one_shot_count: number
  cost: number
}

interface GlobalHealthRow {
  projectId: string
  name: string
  healthScore: number
  healthGrade: string
  findingCount: number
  highCount: number
}

interface GlobalReport {
  tokenBreakdown: { input: number; output: number; cacheRead: number; cacheWrite: number }
  cacheStats: { hitRate: number; grossSavings: number; writeCost: number; netRoi: number }
  topSessions: Array<{ session_id: string; start_time: number; cost_usd: number; model: string | null; project_name: string; display_name: string | null }>
  toolStats: { topTools: Array<{ name: string; count: number }> }
  shellStats: { byCategory: Record<string, number>; topCommands: Array<{ cmd: string; count: number }> }
}

interface AggregatedFinding {
  id: string
  title: string
  impact: string
  affectedProjects: number
  projectNames: string[]
  fix: { label: string; text: string }
}

interface OverviewProps {
  onNavigate: (page: Page, projectId?: string) => void
}

export default function Overview({ onNavigate }: OverviewProps): React.ReactElement {
  const { t } = useI18n()
  const PERIOD_LABELS: Record<Period, string> = { 1: t.today, 7: t.days7, 30: t.days30, 0: t.allTime }
  const [period, setPeriod] = useState<Period>(0)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [dayRows, setDayRows] = useState<DayRow[]>([])
  const [modelRows, setModelRows] = useState<ModelRow[]>([])
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])
  const [healthRows, setHealthRows] = useState<GlobalHealthRow[]>([])
  const [globalReport, setGlobalReport] = useState<GlobalReport | null>(null)
  const [aggregatedFindings, setAggregatedFindings] = useState<AggregatedFinding[]>([])
  const [copiedFix, setCopiedFix] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function fetchAll(p: Period): void {
    setLoading(true)
    // optimize.global() writes waste_cache; aggregated() reads it — must run in sequence
    Promise.all([
      window.claudeInsight.report.byProject(p),
      window.claudeInsight.report.byDay(null, p),
      window.claudeInsight.report.byModel(null, p),
      window.claudeInsight.projects.activity(null, p),
      window.claudeInsight.optimize.global(),
      window.claudeInsight.report.global(p),
    ]).then(([projs, days, models, activity, health, globalRep]) => {
      setProjects(projs as ProjectRow[])
      setDayRows(days as DayRow[])
      setModelRows(models as ModelRow[])
      setActivityRows(activity as ActivityRow[])
      setHealthRows(health as GlobalHealthRow[])
      setGlobalReport(globalRep as GlobalReport)
      setLoading(false)
      // fetch aggregated findings after waste_cache is populated
      return window.claudeInsight.optimize.aggregated()
    }).then((aggFindings) => {
      setAggregatedFindings(aggFindings as AggregatedFinding[])
    })
  }

  useEffect(() => {
    fetchAll(period)
  }, [period])

  useEffect(() => {
    const unsub = window.claudeInsight.onDataUpdated(() => fetchAll(period))
    return (): void => { unsub() }
  }, [period])

  if (loading) return <LoadingSkeleton />

  const totalCost = projects.reduce((a, p) => a + (p.total_cost ?? 0), 0)
  const totalSessions = projects.reduce((a, p) => a + (p.session_count ?? p.total_sessions ?? 0), 0)
  const avgCacheRate = totalSessions > 0
    ? projects.reduce((a, p) => {
        const sessions = p.session_count ?? p.total_sessions ?? 0
        const rate = p.cacheHitRate ?? p.cumulative_cache_hit_rate ?? 0
        return a + rate * sessions
      }, 0) / totalSessions
    : 0
  const activeCount = projects.filter(p => (p.session_count ?? p.total_sessions ?? 0) > 0).length

  if (projects.length === 0 && totalCost === 0 && dayRows.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
        <h2 style={{ marginBottom: 8, fontSize: 18 }}>{t.noDataYet}</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
          {t.noDataDesc}
        </p>
      </div>
    )
  }

  const topProjects = [...projects].sort((a, b) => (b.total_cost ?? 0) - (a.total_cost ?? 0)).slice(0, 8)
  const maxProjectCost = Math.max(...topProjects.map(p => p.total_cost ?? 0), 0.0001)

  const recentDays = period === 0 ? dayRows.slice(-14) : dayRows
  const maxDayCost = Math.max(...recentDays.map(d => d.cost), 0.0001)

  const topModels = modelRows.slice(0, 6)
  const maxModelCost = Math.max(...topModels.map(m => m.total_cost), 0.0001)

  const topActivities = [...activityRows].sort((a, b) => b.cost - a.cost).slice(0, 8)
  const maxActivityCost = Math.max(...topActivities.map(a => a.cost), 0.0001)

  return (
    <div>
      {/* Header + period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.overview}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 2 }}>
            {t.allProjects} · {projects.length} {t.active}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 8, padding: 3 }}>
          {([1, 7, 30, 0] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: period === p ? 'var(--color-surface)' : 'transparent',
                color: period === p ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontSize: 12, fontWeight: period === p ? 700 : 400, cursor: 'pointer',
                transition: 'all 120ms',
                boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 'var(--space-lg)' }}>
        <KpiCard label={t.totalSpend} value={`$${totalCost.toFixed(2)}`} sub={t.acrossProjects(activeCount)} color="var(--color-orange)" />
        <KpiCard label={t.sessions} value={String(totalSessions)} sub={t.avgPerSession(`$${totalSessions > 0 ? (totalCost / totalSessions).toFixed(3) : '0'}`)} color="var(--color-blue)" />
        <KpiCard label={t.cacheHit} value={`${(avgCacheRate * 100).toFixed(1)}%`} sub={t.weightedAvg} color="var(--color-teal)" />
        <KpiCard label={t.activeProjects} value={String(activeCount)} sub={topProjects[0]?.display_name ?? topProjects[0]?.name ?? '—'} color="var(--color-yellow)" />
      </div>

      {/* Row 2: Daily Activity + By Project */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        {/* Daily Activity bar chart */}
        <Panel title={t.dailyActivity} accent="var(--color-teal)">
          {recentDays.length === 0 ? <Empty t={t} /> : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72, marginBottom: 6 }}>
                {recentDays.map((d) => {
                  const h = Math.max((d.cost / maxDayCost) * 68, d.cost > 0 ? 3 : 0)
                  const ratio = d.cost / maxDayCost
                  const col = gradColor(ratio)
                  return (
                    <div
                      key={d.day}
                      title={`${d.day}: $${d.cost.toFixed(4)} · ${d.session_count} sessions`}
                      style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0', background: col, minWidth: 3 }}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{recentDays[0]?.day}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{recentDays[recentDays.length - 1]?.day}</span>
              </div>
              {/* Column headers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--color-border)' }}>
                <span>{t.date}</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ minWidth: 56, textAlign: 'right' }}>{t.sessions}</span>
                  <span style={{ minWidth: 52, textAlign: 'right' }}>{t.cost}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {recentDays.slice(-6).reverse().map(d => (
                  <div key={d.day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.day}</span>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ minWidth: 56, textAlign: 'right', color: 'var(--color-text-muted)' }}>{d.session_count}</span>
                      <span style={{ minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-orange)' }}>${d.cost.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* By Project */}
        <Panel title={t.byProject} accent="var(--color-orange)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 56, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t.project}</span>
            <span style={{ minWidth: 40, textAlign: 'right' }}>{t.sessions}</span>
            <span style={{ minWidth: 52, textAlign: 'right' }}>{t.cost}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topProjects.map((p) => {
              const cost = p.total_cost ?? 0
              const sessions = p.session_count ?? p.total_sessions ?? 0
              const ratio = cost / maxProjectCost
              return (
                <button
                  key={p.project_id}
                  onClick={() => onNavigate('project', p.project_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '1px 0' }}
                >
                  <div style={{ width: 56, height: 6, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${ratio * 100}%`, background: gradColor(ratio), borderRadius: 2 }} />
                  </div>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                    {p.display_name ?? p.name}
                  </span>
                  <span style={{ minWidth: 40, textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {sessions}
                  </span>
                  <span style={{ minWidth: 52, textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-orange)', fontWeight: 600 }}>
                    ${cost.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Row 3: By Activity + By Model */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        {/* By Activity — codeburn ActivitySection style */}
        <Panel title={t.byActivity} accent="var(--color-blue)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 56, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t.activityType}</span>
            <span style={{ minWidth: 52, textAlign: 'right' }}>{t.cost}</span>
            <span style={{ minWidth: 44, textAlign: 'right' }}>{t.sessions}</span>
            <span style={{ minWidth: 44, textAlign: 'right' }}>{t.oneShot}</span>
          </div>
          {topActivities.length === 0 ? <Empty t={t} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topActivities.map(a => {
                const ratio = a.cost / maxActivityCost
                const oneShotRate = a.count > 0 ? a.one_shot_count / a.count : null
                const label = ACTIVITY_LABELS[a.activity_type] ?? a.activity_type
                return (
                  <div key={a.activity_type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1px 2px' }}>
                    {/* Fixed bar */}
                    <div style={{ width: 56, height: 6, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${ratio * 100}%`, background: 'var(--color-blue)', borderRadius: 2, transition: 'width 300ms ease' }} />
                    </div>
                    {/* Label */}
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                    {/* Cost */}
                    <span style={{ minWidth: 52, textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-orange)', fontWeight: 600 }}>
                      ${a.cost.toFixed(3)}
                    </span>
                    {/* Sessions */}
                    <span style={{ minWidth: 44, textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {a.count}
                    </span>
                    {/* 1-shot rate */}
                    <span style={{ minWidth: 44, textAlign: 'right', fontSize: 10.5, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {oneShotRate !== null ? `${Math.round(oneShotRate * 100)}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* By Model */}
        <Panel title={t.byModel} accent="var(--color-purple)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 56, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{t.model}</span>
            <span style={{ minWidth: 40, textAlign: 'right' }}>{t.cache}</span>
            <span style={{ minWidth: 40, textAlign: 'right' }}>{t.sessions}</span>
            <span style={{ minWidth: 52, textAlign: 'right' }}>{t.cost}</span>
          </div>
          {topModels.length === 0 ? <Empty t={t} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topModels.map((m, i) => {
                const ratio = m.total_cost / maxModelCost
                return (
                  <div key={m.model} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 56, height: 6, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${ratio * 100}%`, background: `hsl(${270 + i * 30}, 80%, 65%)`, borderRadius: 2 }} />
                    </div>
                    <span style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.model.replace('claude-', '')}
                    </span>
                    <span style={{ minWidth: 40, textAlign: 'right', fontSize: 11, color: m.cacheHitRate > 0.5 ? 'var(--color-teal)' : m.cacheHitRate > 0.2 ? 'var(--color-yellow)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {(m.cacheHitRate * 100).toFixed(0)}%
                    </span>
                    <span style={{ minWidth: 40, textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {m.session_count}
                    </span>
                    <span style={{ minWidth: 52, textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: `hsl(${270 + i * 30}, 80%, 65%)`, fontWeight: 600 }}>
                      ${m.total_cost.toFixed(3)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Row 4: Optimize Health */}
      <Panel title={t.optimizeHealth} accent="var(--color-green)">
        {healthRows.length === 0 ? <Empty t={t} /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
              {healthRows.map((h) => {
                const gradeColor = h.healthGrade === 'A' ? 'var(--color-green)' : h.healthGrade === 'B' ? 'var(--color-teal)' : h.healthGrade === 'C' ? 'var(--color-yellow)' : h.healthGrade === 'D' ? 'var(--color-orange)' : 'var(--color-red)'
                return (
                  <button
                    key={h.projectId}
                    onClick={() => onNavigate('project', h.projectId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 7, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', boxShadow: 'var(--shadow-card)' }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: gradeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {h.healthGrade}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{h.healthScore}/100</div>
                    </div>
                    {h.findingCount > 0 && (
                      <div style={{ fontSize: 11, color: h.highCount > 0 ? 'var(--color-red)' : 'var(--color-yellow)', fontWeight: 700, flexShrink: 0 }}>
                        {h.findingCount} {t.issue}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </Panel>

      {/* Row 5: Report — Token Breakdown + Cache ROI + Top Tools + Shell */}
      {globalReport && (() => {
        const tb = globalReport.tokenBreakdown
        const total = tb.input + tb.output + tb.cacheRead + tb.cacheWrite
        const tokenSegments = [
          { label: 'Input', i18nLabel: t.input, value: tb.input, color: 'var(--color-blue)' },
          { label: 'Output', i18nLabel: t.output, value: tb.output, color: 'var(--color-purple)' },
          { label: 'Cache Read', i18nLabel: t.cacheRead, value: tb.cacheRead, color: 'var(--color-teal)' },
          { label: 'Cache Write', i18nLabel: t.cacheWrite, value: tb.cacheWrite, color: 'var(--color-yellow)' },
        ]
        const cs = globalReport.cacheStats
        const shellCats = Object.entries(globalReport.shellStats.byCategory)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
        const maxShell = Math.max(...shellCats.map(([, v]) => v), 1)
        const topTools = globalReport.toolStats.topTools.slice(0, 8)
        const maxTool = Math.max(...topTools.map(t => t.count), 1)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <Panel title={t.reportTokensCache} accent="var(--color-teal)">
              {/* Stacked bar */}
              <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                {tokenSegments.map(seg => (
                  <div key={seg.label} style={{ flex: seg.value / Math.max(total, 1), background: seg.color, minWidth: seg.value > 0 ? 2 : 0, transition: 'flex 300ms' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 14 }}>
                {tokenSegments.map(seg => (
                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--color-text-muted)' }}>{seg.i18nLabel}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtTokens(seg.value)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCell label={t.cacheHitRate} value={`${(cs.hitRate * 100).toFixed(1)}%`} color={cs.hitRate > 0.4 ? 'var(--color-teal)' : 'var(--color-text-muted)'} />
                <StatCell label={t.grossSavings} value={`$${cs.grossSavings.toFixed(2)}`} color="var(--color-teal)" />
                <StatCell label={t.writeCost} value={`$${cs.writeCost.toFixed(2)}`} color="var(--color-text-muted)" />
                <StatCell label={t.netCacheRoi} value={`${cs.netRoi >= 0 ? '+' : ''}$${cs.netRoi.toFixed(2)}`} color={cs.netRoi >= 0 ? 'var(--color-green)' : 'var(--color-red)'} />
              </div>
              {/* Top sessions */}
              {globalReport.topSessions.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginTop: 14, marginBottom: 6 }}>{t.topCostSessions}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ flex: 1 }}>{t.project}</span>
                    <span style={{ minWidth: 52, textAlign: 'right' }}>{t.cost}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {globalReport.topSessions.slice(0, 5).map(s => (
                      <div key={s.session_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                          {s.display_name ?? s.project_name}
                        </span>
                        <span style={{ minWidth: 52, textAlign: 'right', color: 'var(--color-orange)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ${s.cost_usd.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>

            <Panel title={t.reportToolsShell} accent="var(--color-purple)">
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>{t.topTools}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {topTools.map(t => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 48, height: 5, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${(t.count / maxTool) * 100}%`, background: 'var(--color-purple)', borderRadius: 2 }} />
                    </div>
                    <span style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{t.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>{t.shellByCategory}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {shellCats.map(([cat, count]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 48, height: 5, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${(count / maxShell) * 100}%`, background: gradColor(count / maxShell), borderRadius: 2 }} />
                      </div>
                      <span style={{ flex: 1, fontSize: 11, textTransform: 'capitalize' }}>{cat}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )
      })()}

      {/* Row 6: Optimize Insights — aggregated findings across all projects */}
      {aggregatedFindings.length > 0 && (
        <Panel title={t.optimizeInsights} accent="var(--color-orange)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {aggregatedFindings.map(f => {
              const impactColor = f.impact === 'high' ? 'var(--color-red)' : f.impact === 'medium' ? 'var(--color-yellow)' : 'var(--color-text-muted)'
              const impactBg = f.impact === 'high' ? 'rgba(248,113,113,0.07)' : f.impact === 'medium' ? 'rgba(245,158,11,0.07)' : 'transparent'
              return (
                <div key={f.id} style={{ background: impactBg, border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: 2, background: impactColor, borderRadius: 1, position: 'absolute', top: 0, left: 0, right: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: impactColor, marginRight: 6 }}>{f.impact}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{f.title}</span>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: impactColor }}>{f.affectedProjects}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>project{f.affectedProjects !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    {t.affects}: {f.projectNames.join(', ')}{f.affectedProjects > f.projectNames.length ? ` +${f.affectedProjects - f.projectNames.length} ${t.more}` : ''}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(f.fix.text).then(() => {
                        setCopiedFix(f.id)
                        setTimeout(() => setCopiedFix(null), 2000)
                      })
                    }}
                    style={{ padding: '4px 10px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 5, color: 'var(--color-text)', fontSize: 11, cursor: 'pointer' }}
                  >
                    {copiedFix === f.id ? t.copied : `⎘ ${f.fix.label}`}
                  </button>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Utilities ────────────────────────────────────────────────────────────────

/** Teal (low) → Orange (mid) → Red (high) gradient matching codeburn's palette */
function gradColor(ratio: number): string {
  if (ratio < 0.5) {
    const t = ratio * 2
    const r = Math.round(t * 255 + (1 - t) * 45)
    const g = Math.round(t * 140 + (1 - t) * 212)
    const b = Math.round(t * 66 + (1 - t) * 191)
    return `rgb(${r},${g},${b})`
  }
  const t = (ratio - 0.5) * 2
  const r = Math.round(t * 245 + (1 - t) * 255)
  const g = Math.round(t * 91 + (1 - t) * 140)
  const b = Math.round(t * 91 + (1 - t) * 66)
  return `rgb(${r},${g},${b})`
}

// ── Primitives ───────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
      <div style={{ height: 2, borderRadius: 1, background: color, marginBottom: 10 }} />
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  )
}

function Panel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 'var(--space-md)', border: '1px solid var(--color-border)' }}>
      <div style={{ height: 2, borderRadius: 1, background: accent, marginBottom: 12 }} />
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function Empty({ t }: { t: { noDataPeriod: string } }): React.ReactElement {
  return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{t.noDataPeriod}</span>
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div style={{ padding: 'var(--space-lg)' }}>
      <div style={{ height: 28, width: 140, background: 'var(--color-surface-2)', borderRadius: 6, marginBottom: 24, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ height: 90, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ height: 220, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ height: 180, background: 'var(--color-surface)', borderRadius: 10, animation: 'pulse 1.5s ease infinite' }} />
        ))}
      </div>
    </div>
  )
}
