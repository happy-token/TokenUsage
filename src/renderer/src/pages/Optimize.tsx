import React, { useEffect, useState } from 'react'
import type { HealthGrade, WasteFinding } from '../types'

interface OptimizeResult {
  findings: WasteFinding[]
  healthScore: number
  healthGrade: HealthGrade
}

interface OptimizeProps {
  projectId: string | null
}

const GRADE_COLOR: Record<HealthGrade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444'
}

const IMPACT_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8'
}

export default function Optimize({ projectId }: OptimizeProps): React.ReactElement {
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function runScan(): void {
    if (!projectId) return
    setLoading(true)
    window.claudeInsight.optimize.run(projectId).then((r) => {
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

  if (!projectId) {
    return <div style={{ color: 'var(--color-text-muted)', marginTop: 40 }}>Select a project to scan for waste.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Optimize</h1>
        <button
          onClick={runScan}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {loading && <div style={{ color: 'var(--color-text-muted)' }}>Running waste detectors...</div>}

      {result && !loading && (
        <>
          {/* Health score */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-lg)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 48,
                fontWeight: 800,
                color: GRADE_COLOR[result.healthGrade],
                lineHeight: 1
              }}>
                {result.healthGrade}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>Grade</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{result.healthScore}/100</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {result.findings.length === 0
                  ? 'No waste detected — great habits!'
                  : `${result.findings.length} issue${result.findings.length !== 1 ? 's' : ''} found`}
              </div>
            </div>
          </div>

          {result.findings.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-xl)',
              color: 'var(--color-text-muted)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              All clear — no waste patterns detected in this project.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {result.findings.map((f) => (
                <div
                  key={f.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: `1px solid var(--color-border)`,
                    borderLeft: `3px solid ${IMPACT_COLOR[f.impact]}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: IMPACT_COLOR[f.impact],
                            marginRight: 8
                          }}
                        >
                          {f.impact}
                        </span>
                        {f.title}
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{f.explanation}</div>
                    </div>
                    {f.tokensSaved > 0 && (
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>~saves</div>
                        <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                          {f.tokensSaved.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>tokens</div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => copyFix(f.id, f.fix.text)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text)',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  >
                    {copied === f.id ? 'Copied!' : `⎘ ${f.fix.label}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
