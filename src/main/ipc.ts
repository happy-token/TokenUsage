import type { IpcMain } from 'electron'
import { shell } from 'electron'
import {
  getProjects,
  getProjectById,
  getSessionsByProject,
  getSessionById,
  getSessionActivity,
  getProjectActivityStats,
  getProjectReport,
  getGlobalReport,
  getReportByDay,
  getReportByModel,
  getReportBySession,
  getReportByProject,
  deleteSession,
  deleteProject
} from './store'
import { runOptimize, runGlobalOptimize, getAggregatedFindings } from './optimize'

type RefreshCallback = () => void
let _onRefresh: RefreshCallback | null = null

export function setRefreshCallback(cb: RefreshCallback): void {
  _onRefresh = cb
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('projects:list', () => getProjects())

  ipcMain.handle('projects:get', (_e, projectId: string) => getProjectById(projectId))

  ipcMain.handle('projects:sessions', (_e, projectId: string, limit?: number) =>
    getSessionsByProject(projectId, limit)
  )

  ipcMain.handle('projects:activity', (_e, projectId: string | null, periodDays?: number) =>
    getProjectActivityStats(projectId, periodDays)
  )

  ipcMain.handle('sessions:get', (_e, sessionId: string) => getSessionById(sessionId))

  ipcMain.handle('sessions:activity', (_e, sessionId: string) => getSessionActivity(sessionId))

  ipcMain.handle('optimize:run', (_e, projectId: string, periodDays?: number) =>
    runOptimize(projectId, periodDays)
  )

  ipcMain.handle('optimize:global', (_e, periodDays?: number) =>
    runGlobalOptimize(periodDays)
  )

  ipcMain.handle('optimize:aggregated', () =>
    getAggregatedFindings()
  )

  ipcMain.handle('report:global', (_e, periodDays: number) =>
    getGlobalReport(periodDays)
  )

  ipcMain.handle('projects:report', (_e, projectId: string, periodDays: number) =>
    getProjectReport(projectId, periodDays)
  )

  ipcMain.handle('report:byDay', (_e, projectId: string | null, periodDays: number) =>
    getReportByDay(projectId, periodDays)
  )

  ipcMain.handle('report:byModel', (_e, projectId: string | null, periodDays: number) =>
    getReportByModel(projectId, periodDays)
  )

  ipcMain.handle('report:bySession', (_e, projectId: string, periodDays: number) =>
    getReportBySession(projectId, periodDays)
  )

  ipcMain.handle('report:byProject', (_e, periodDays: number) =>
    getReportByProject(periodDays)
  )

  ipcMain.handle('sessions:delete', (_e, sessionId: string) => {
    deleteSession(sessionId)
    _onRefresh?.()
  })

  ipcMain.handle('projects:delete', (_e, projectId: string) => {
    deleteProject(projectId)
    _onRefresh?.()
  })

  ipcMain.handle('data:refresh', () => {
    _onRefresh?.()
  })

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    shell.openExternal(url)
  })
}
