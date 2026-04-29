import { contextBridge, ipcRenderer } from 'electron'

const api = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (projectId: string) => ipcRenderer.invoke('projects:get', projectId),
    sessions: (projectId: string, limit?: number) =>
      ipcRenderer.invoke('projects:sessions', projectId, limit),
    activity: (projectId: string | null, periodDays?: number) => ipcRenderer.invoke('projects:activity', projectId, periodDays),
    report: (projectId: string, periodDays: number) =>
      ipcRenderer.invoke('projects:report', projectId, periodDays),
    delete: (projectId: string) => ipcRenderer.invoke('projects:delete', projectId)
  },
  sessions: {
    get: (sessionId: string) => ipcRenderer.invoke('sessions:get', sessionId),
    activity: (sessionId: string) => ipcRenderer.invoke('sessions:activity', sessionId),
    delete: (sessionId: string) => ipcRenderer.invoke('sessions:delete', sessionId)
  },
  report: {
    byDay: (projectId: string | null, periodDays: number) =>
      ipcRenderer.invoke('report:byDay', projectId, periodDays),
    byModel: (projectId: string | null, periodDays: number) =>
      ipcRenderer.invoke('report:byModel', projectId, periodDays),
    bySession: (projectId: string, periodDays: number) =>
      ipcRenderer.invoke('report:bySession', projectId, periodDays),
    byProject: (periodDays: number) =>
      ipcRenderer.invoke('report:byProject', periodDays),
    global: (periodDays: number) =>
      ipcRenderer.invoke('report:global', periodDays)
  },
  optimize: {
    run: (projectId: string, periodDays?: number) =>
      ipcRenderer.invoke('optimize:run', projectId, periodDays),
    global: (periodDays?: number) =>
      ipcRenderer.invoke('optimize:global', periodDays),
    aggregated: () =>
      ipcRenderer.invoke('optimize:aggregated')
  },
  refresh: () => ipcRenderer.invoke('data:refresh'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  onDataUpdated: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('data-updated', handler)
    return () => ipcRenderer.removeListener('data-updated', handler)
  }
}

contextBridge.exposeInMainWorld('tokenUsage', api)

export type TokenUsageAPI = typeof api
