import type { IpcMain } from 'electron'
import {
  getProjects,
  getProjectById,
  getSessionsByProject,
  getSessionById,
  getSessionActivity,
  getProjectActivityStats
} from './store'
import { runOptimize } from './optimize'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('projects:list', () => getProjects())

  ipcMain.handle('projects:get', (_e, projectId: string) => getProjectById(projectId))

  ipcMain.handle('projects:sessions', (_e, projectId: string, limit?: number) =>
    getSessionsByProject(projectId, limit)
  )

  ipcMain.handle('projects:activity', (_e, projectId: string) =>
    getProjectActivityStats(projectId)
  )

  ipcMain.handle('sessions:get', (_e, sessionId: string) => getSessionById(sessionId))

  ipcMain.handle('sessions:activity', (_e, sessionId: string) => getSessionActivity(sessionId))

  ipcMain.handle('optimize:run', (_e, projectId: string, periodDays?: number) =>
    runOptimize(projectId, periodDays)
  )
}
