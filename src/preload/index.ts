import { contextBridge, ipcRenderer } from 'electron'

const api = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (projectId: string) => ipcRenderer.invoke('projects:get', projectId),
    sessions: (projectId: string, limit?: number) =>
      ipcRenderer.invoke('projects:sessions', projectId, limit),
    activity: (projectId: string) => ipcRenderer.invoke('projects:activity', projectId)
  },
  sessions: {
    get: (sessionId: string) => ipcRenderer.invoke('sessions:get', sessionId),
    activity: (sessionId: string) => ipcRenderer.invoke('sessions:activity', sessionId)
  },
  optimize: {
    run: (projectId: string, periodDays?: number) =>
      ipcRenderer.invoke('optimize:run', projectId, periodDays)
  },
  onDataUpdated: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('data-updated', handler)
    return () => ipcRenderer.removeListener('data-updated', handler)
  }
}

contextBridge.exposeInMainWorld('claudeInsight', api)

export type ClaudeInsightAPI = typeof api
