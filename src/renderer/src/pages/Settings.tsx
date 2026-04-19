import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../contexts/I18nContext'
import type { Theme } from '../contexts/ThemeContext'
import type { Lang } from '../contexts/I18nContext'

export default function Settings(): React.ReactElement {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-lg)', letterSpacing: '-0.3px' }}>
        {t.settings}
      </h1>

      <Section title={t.appearance}>
        <Row label={t.theme}>
          <SegmentControl
            options={[
              { value: 'dark', label: t.dark },
              { value: 'light', label: t.light }
            ]}
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
          />
        </Row>
        <Row label={t.language}>
          <SegmentControl
            options={[
              { value: 'en', label: t.english },
              { value: 'zh', label: t.chinese }
            ]}
            value={lang}
            onChange={(v) => setLang(v as Lang)}
          />
        </Row>
      </Section>

      <Section title={t.general}>
        <Row label={t.version}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            v0.1.0
          </span>
        </Row>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--color-text-muted)', marginBottom: 8
      }}>{title}</div>
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border)'
    }}
      className="settings-row"
    >
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  )
}

function SegmentControl({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--color-surface-2)',
      borderRadius: 8,
      padding: 2,
      gap: 2
    }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              background: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease'
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
