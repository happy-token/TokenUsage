import React from 'react'

interface InsightsProps {
  projectId: string | null
}

export default function Insights({ projectId: _ }: InsightsProps): React.ReactElement {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Insights</h1>
      <div style={{ color: 'var(--color-text-muted)' }}>
        Rules Engine and LLM-powered insights — coming in v0.2.
      </div>
    </div>
  )
}
