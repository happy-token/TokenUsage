import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import { ThemeProvider } from './contexts/ThemeContext'
import { I18nProvider } from './contexts/I18nContext'

export type Page = 'overview' | 'project' | 'settings'

function AppInner(): React.ReactElement {
  const [page, setPage] = useState<Page>('overview')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.claudeInsight.onDataUpdated(() => {
      setPage((p) => p)
    })
    return (): void => { unsub() }
  }, [])

  function navigateTo(p: Page, projectId?: string): void {
    setPage(p)
    if (projectId !== undefined) setSelectedProjectId(projectId)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activePage={page} selectedProjectId={selectedProjectId} onNavigate={navigateTo} />
      <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-lg)' }}>
        {page === 'overview' && <Overview onNavigate={navigateTo} />}
        {page === 'project' && (
          <ProjectDetail
            projectId={selectedProjectId}
            onNavigate={navigateTo}
          />
        )}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppInner />
      </I18nProvider>
    </ThemeProvider>
  )
}
