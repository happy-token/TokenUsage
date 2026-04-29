import React, { useEffect, useState } from 'react'
import type { HealthGrade, WasteFinding, Win } from '../types'
import { useI18n } from '../contexts/I18nContext'

interface OptimizeResult {
  findings: WasteFinding[]
  wins: Win[]
  healthScore: number
  healthGrade: HealthGrade
}

interface OptimizeProps {
  projectId: string | null
}

const GRADE_COLOR: Record<HealthGrade, string> = {
  A: 'var(--color-green)',
  B: 'var(--color-teal)',
  C: 'var(--color-yellow)',
  D: 'var(--color-orange)',
  F: 'var(--color-red)'
}

const GRADE_BG: Record<HealthGrade, string> = {
  A: 'rgba(61, 214, 140, 0.08)',
  B: 'rgba(45, 212, 191, 0.08)',
  C: 'rgba(251, 191, 36, 0.08)',
  D: 'rgba(245, 158, 11, 0.08)',
  F: 'rgba(248, 113, 113, 0.08)'
}

const IMPACT_COLOR: Record<string, string> = {
  high: 'var(--color-red)',
  medium: 'var(--color-orange)',
  low: 'var(--color-text-muted)'
}

export default function Optimize({ projectId }: OptimizeProps): React.ReactElement {
  const { t } = useI18n()
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function runScan(): void {
    if (!projectId) return
    setLoading(true)
    window.tokenUsage.optimize.run(projectId).then((r) => {
      setResult(r as OptimizeResult)
      setLoading(false)
    })
  }

  useEffect(() => {
    if (projectId) runScan()
  }, [projectId])

  function copyFix(findingId: string, text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(findingId)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function toggleExpand(id: string): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!projectId) {
    return <div style={{ color: 'var(--color-text-muted)', marginTop: 40 }}>Select a project to scan for waste.</div>
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonCard height={80} />
        <SkeletonCard height={100} />
        <SkeletonCard height={100} />
      </div>
    )
  }

  if (!result) return <></>

  const { findings, wins, healthScore, healthGrade } = result
  const highCount = findings.filter((f) => f.impact === 'high').length
  const totalSaved = findings.reduce((s, f) => s + f.tokensSaved, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Health score header */}
      <div style={{
        background: GRADE_BG[healthGrade],
        border: `1px solid var(--color-border)`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: GRADE_COLOR[healthGrade], lineHeight: 1, letterSpacing: '-0.04em' }}>
            {healthGrade}
          </div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginTop: 2 }}>{t.grade}</div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{healthScore}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>/100</span>
            {findings.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--color-green)', fontWeight: 600, marginLeft: 4 }}>All clear</span>
            ) : (
              <span style={{ fontSize: 12, color: highCount > 0 ? 'var(--color-red)' : 'var(--color-orange)', fontWeight: 600, marginLeft: 4 }}>
                {findings.length} {t.issues}
                {highCount > 0 ? ` · ${highCount} high` : ''}
              </span>
            )}
          </div>

          <HealthBar score={healthScore} grade={healthGrade} />

          {totalSaved > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Potential savings: ~{fmtTok(totalSaved)} tokens/period
            </div>
          )}
        </div>

        <button
          onClick={runScan}
          style={{
            padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0
          }}
        >
          ↺ Rescan
        </button>
      </div>

      {/* Wins section */}
      {wins.length > 0 && (
        <div style={{
          background: 'rgba(61, 214, 140, 0.04)',
          border: '1px solid rgba(61, 214, 140, 0.2)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-green)' }}>✓</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-green)' }}>What&apos;s working</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {wins.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--color-green)', flexShrink: 0, paddingTop: 2 }}>●</span>
                <span style={{ fontSize: 12 }}>{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--color-text-muted)', fontSize: 13,
          background: 'var(--color-surface)', borderRadius: 10,
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ fontSize: 22, marginBottom: 6, color: 'var(--color-green)' }}>✓</div>
          No waste patterns found in this project.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {findings.length} {findings.length === 1 ? 'finding' : 'findings'} — sorted by impact
          </div>
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              copied={copied}
              expanded={!!expanded[f.id]}
              onToggle={() => toggleExpand(f.id)}
              onCopy={copyFix}
              copiedLabel={t.copied}
            />
          ))}
        </>
      )}
    </div>
  )
}

function FindingCard({
  finding: f,
  copied,
  expanded,
  onToggle,
  onCopy,
  copiedLabel,
}: {
  finding: WasteFinding
  copied: string | null
  expanded: boolean
  onToggle: () => void
  onCopy: (id: string, text: string) => void
  copiedLabel: string
}): React.ReactElement {
  const isCopied = copied === f.id
  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--color-surface)',
    }}>
      {/* Impact accent bar */}
      <div style={{ height: 2, background: IMPACT_COLOR[f.impact] }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: IMPACT_COLOR[f.impact], flexShrink: 0, paddingTop: 2
          }}>
            {f.impact}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{f.title}</span>
          {f.tokensSaved > 0 && (
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              ~{fmtTok(f.tokensSaved)} tokens
            </span>
          )}
        </div>

        {/* Explanation */}
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          {f.explanation}
        </div>

        {/* Fix section */}
        <div
          onClick={onToggle}
          style={{
            background: 'var(--color-surface-2)',
            borderRadius: 7,
            padding: '8px 10px',
            cursor: 'pointer',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {f.fix.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {expanded && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCopy(f.id, f.fix.text) }}
                  style={{
                    padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                    border: '1px solid var(--color-border)',
                    background: isCopied ? 'rgba(61, 214, 140, 0.1)' : 'transparent',
                    color: isCopied ? 'var(--color-green)' : 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {isCopied ? copiedLabel : '⎘ Copy'}
                </button>
              )}
              <span style={{ fontSize: 9, color: 'var(--color-text-muted)', opacity: 0.6 }}>
                {expanded ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {expanded && (
            <pre style={{
              marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--color-teal)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              lineHeight: 1.6, margin: '8px 0 0 0', padding: 0, background: 'none',
              borderTop: '1px solid var(--color-border)', paddingTop: 8,
            }}>
              {f.fix.text}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function HealthBar({ score, grade }: { score: number; grade: HealthGrade }): React.ReactElement {
  return (
    <div style={{ height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${score}%`,
        background: GRADE_COLOR[grade],
        borderRadius: 2,
        transition: 'width 0.6s ease'
      }} />
    </div>
  )
}

function SkeletonCard({ height }: { height: number }): React.ReactElement {
  return (
    <div style={{
      height,
      background: 'var(--color-surface)',
      borderRadius: 10,
      border: '1px solid var(--color-border)',
      animation: 'pulse 1.5s ease infinite'
    }} />
  )
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
