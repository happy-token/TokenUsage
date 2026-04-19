import React from 'react'

export default function Settings(): React.ReactElement {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Settings</h1>
      <div style={{ color: 'var(--color-text-muted)' }}>
        API key configuration and custom data path — coming in v0.2.
      </div>
    </div>
  )
}
