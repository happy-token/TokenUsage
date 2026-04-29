import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../contexts/I18nContext'
import type { Theme } from '../contexts/ThemeContext'
import type { Lang } from '../contexts/I18nContext'
import AppLogo from '../components/AppLogo'

const GITHUB_URL = 'https://github.com/Thinkre/TokenUsage'

export default function Settings(): React.ReactElement {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  function openUrl(url: string): void {
    window.tokenUsage.openExternal(url)
  }

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

      {/* About */}
      <Section title={t.about}>
        <div style={{ padding: '20px 16px 16px' }}>
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <AppLogo size={36} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>TokenUsage</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>v0.1.0</div>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.65, marginBottom: 16 }}>
            {t.aboutDesc}
          </p>

          {/* Privacy badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderRadius: 6, padding: '5px 10px', fontSize: 11,
            color: 'var(--color-text-muted)', marginBottom: 16
          }}>
            {t.aboutPrivacy}
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <ActionButton
              label={t.aboutStar}
              primary
              onClick={() => openUrl(GITHUB_URL)}
            />
            <ActionButton
              label={t.aboutIssue}
              onClick={() => openUrl(`${GITHUB_URL}/issues`)}
            />
          </div>

          {/* Open source note */}
          <button
            onClick={() => openUrl(GITHUB_URL)}
            style={{
              fontSize: 11, color: 'var(--color-accent)', background: 'none',
              cursor: 'pointer', textDecoration: 'underline', padding: 0,
              display: 'block', marginBottom: 14
            }}
          >
            {t.aboutOpenSource} →
          </button>

          {/* Built with */}
          <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', opacity: 0.6 }}>
            {t.aboutBuiltWith}
          </div>
        </div>
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

function ActionButton({ label, onClick, primary = false }: {
  label: string
  onClick: () => void
  primary?: boolean
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        background: primary ? 'var(--color-accent)' : 'var(--color-surface-2)',
        color: primary ? '#fff' : 'var(--color-text)',
        border: primary ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {label}
    </button>
  )
}
