import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Sessions from './pages/Sessions'
import Optimize from './pages/Optimize'
import Insights from './pages/Insights'
import Settings from './pages/Settings'

export type Page = 'dashboard' | 'projects' | 'sessions' | 'optimize' | 'insights' | 'settings'

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('dashboard')
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
      <Sidebar activePage={page} onNavigate={navigateTo} />
      <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-lg)' }}>
        {page === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
        {page === 'projects' && (
          <Projects
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => navigateTo('projects', id)}
          />
        )}
        {page === 'sessions' && <Sessions projectId={selectedProjectId} />}
        {page === 'optimize' && <Optimize projectId={selectedProjectId} />}
        {page === 'insights' && <Insights projectId={selectedProjectId} />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
