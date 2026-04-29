import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { startWatcher } from './watcher'
import { registerIpcHandlers, setRefreshCallback } from './ipc'
import { getTrayStats } from './store'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Render the happy-T logo as a raw pixel buffer.
// nativeImage.createFromBuffer with {width,height} expects BGRA byte order on macOS.
// viewBox is 40×40; all coordinates below are in that space.
function drawHappyTIcon(size: number): Electron.NativeImage {
  const buf = Buffer.alloc(size * size * 4, 0)

  // BGRA layout: buf[i]=B, buf[i+1]=G, buf[i+2]=R, buf[i+3]=A
  function paint(px: number, py: number, r: number, g: number, b: number, a = 255): void {
    const xi = px | 0, yi = py | 0
    if (xi < 0 || xi >= size || yi < 0 || yi >= size) return
    const i = (yi * size + xi) * 4
    const sa = a / 255, da = buf[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa < 0.001) return
    buf[i]     = ((b * sa + buf[i]     * da * (1 - sa)) / oa) | 0  // B
    buf[i + 1] = ((g * sa + buf[i + 1] * da * (1 - sa)) / oa) | 0  // G
    buf[i + 2] = ((r * sa + buf[i + 2] * da * (1 - sa)) / oa) | 0  // R
    buf[i + 3] = (oa * 255) | 0                                      // A
  }

  // Amber gradient with 10% padding — matches icon.svg squircle spec (x=4,y=4,w=32,h=32,rx=7 on 40px canvas)
  const pad = size * 0.1    // 4/40 of viewBox
  const sq  = size * 0.8    // 32/40
  const cr  = size * 0.175  // 7/40
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const lx = x - pad, ly = y - pad
      if (lx < 0 || lx > sq || ly < 0 || ly > sq) continue
      const nearL = lx < cr, nearR = lx > sq - cr
      const nearT = ly < cr, nearB = ly > sq - cr
      if ((nearL || nearR) && (nearT || nearB)) {
        const cx = nearL ? cr : sq - cr
        const cy = nearT ? cr : sq - cr
        if (Math.hypot(lx - cx, ly - cy) > cr) continue
      }
      const t = (x + y) / (2 * size)
      paint(x, y, (240 + (217 - 240) * t) | 0,
                  (180 + (158 - 180) * t) | 0,
                  ( 41 + ( 34 -  41) * t) | 0)
    }
  }

  const sc = size / 40

  function circle(vcx: number, vcy: number, vr: number, r: number, g: number, b: number): void {
    const pcx = vcx * sc, pcy = vcy * sc, pr = vr * sc
    for (let py = Math.floor(pcy - pr - 1); py <= Math.ceil(pcy + pr + 1); py++) {
      for (let px = Math.floor(pcx - pr - 1); px <= Math.ceil(pcx + pr + 1); px++) {
        const d = Math.hypot(px - pcx, py - pcy)
        if (d < pr) paint(px, py, r, g, b)
        else if (d < pr + 1) paint(px, py, r, g, b, ((pr + 1 - d) * 255) | 0)
      }
    }
  }

  function bezier(vx0: number, vy0: number, vcx: number, vcy: number, vx2: number, vy2: number, vw: number, r: number, g: number, b: number): void {
    const hw = vw / 2
    const steps = size * 4
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      circle((1-t)*(1-t)*vx0 + 2*(1-t)*t*vcx + t*t*vx2,
             (1-t)*(1-t)*vy0 + 2*(1-t)*t*vcy + t*t*vy2,
             hw, r, g, b)
    }
  }

  function roundRect(vx: number, vy: number, vw: number, vh: number, vr: number, r: number, g: number, b: number): void {
    const px0 = vx * sc, py0 = vy * sc, pw = vw * sc, ph = vh * sc, pr = vr * sc
    for (let py = Math.floor(py0); py <= Math.ceil(py0 + ph); py++) {
      for (let px = Math.floor(px0); px <= Math.ceil(px0 + pw); px++) {
        const lx = px - px0, ly = py - py0
        if (lx < 0 || lx > pw || ly < 0 || ly > ph) continue
        const inCx = lx < pr || lx > pw - pr
        const inCy = ly < pr || ly > ph - pr
        if (inCx && inCy) {
          const cx = lx < pr ? pr : pw - pr
          const cy = ly < pr ? pr : ph - pr
          if (Math.hypot(lx - cx, ly - cy) > pr) continue
        }
        paint(px, py, r, g, b)
      }
    }
  }

  // White eyes — matches AppLogo sidebar design
  circle(13.5, 13, 2.5, 255, 255, 255)
  circle(26.5, 13, 2.5, 255, 255, 255)
  // White smile arc = T crossbar: M8,20 Q20,30 32,20
  bezier(8, 20, 20, 30, 32, 20, 3.8, 255, 255, 255)
  // White T stem: x=18 y=20 w=4 h=13 rx=2
  roundRect(18, 20, 4, 13, 2, 255, 255, 255)

  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

// Monochrome template icon for the macOS menu bar.
// Black pixels on transparent background; macOS auto-inverts for dark mode.
// 44×44 buffer rendered at scaleFactor=2 → 22pt visual size.
function drawTrayTemplateIcon(): Electron.NativeImage {
  const size = 44
  const buf = Buffer.alloc(size * size * 4, 0)

  function blend(px: number, py: number, a = 255): void {
    const xi = px | 0, yi = py | 0
    if (xi < 0 || xi >= size || yi < 0 || yi >= size) return
    const i = (yi * size + xi) * 4
    const sa = a / 255, da = buf[i + 3] / 255
    const oa = sa + da * (1 - sa)
    if (oa < 0.001) return
    buf[i] = buf[i + 1] = buf[i + 2] = 0
    buf[i + 3] = (oa * 255) | 0
  }

  const sc = size / 40

  function disc(vcx: number, vcy: number, vr: number): void {
    const pcx = vcx * sc, pcy = vcy * sc, pr = vr * sc
    for (let py = Math.floor(pcy - pr - 1); py <= Math.ceil(pcy + pr + 1); py++)
      for (let px = Math.floor(pcx - pr - 1); px <= Math.ceil(pcx + pr + 1); px++) {
        const d = Math.hypot(px - pcx, py - pcy)
        if (d < pr) blend(px, py)
        else if (d < pr + 1) blend(px, py, ((pr + 1 - d) * 255) | 0)
      }
  }

  function strokeQuad(vx0: number, vy0: number, vcx: number, vcy: number, vx2: number, vy2: number, vw: number): void {
    const steps = size * 4
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      disc((1-t)*(1-t)*vx0 + 2*(1-t)*t*vcx + t*t*vx2,
           (1-t)*(1-t)*vy0 + 2*(1-t)*t*vcy + t*t*vy2,
           vw / 2)
    }
  }

  function fillRect(vx: number, vy: number, vw: number, vh: number, vr: number): void {
    const px0 = vx * sc, py0 = vy * sc, pw = vw * sc, ph = vh * sc, pr = vr * sc
    for (let py = Math.floor(py0); py <= Math.ceil(py0 + ph); py++)
      for (let px = Math.floor(px0); px <= Math.ceil(px0 + pw); px++) {
        const lx = px - px0, ly = py - py0
        if (lx < 0 || lx > pw || ly < 0 || ly > ph) continue
        const inCx = lx < pr || lx > pw - pr
        const inCy = ly < pr || ly > ph - pr
        if (inCx && inCy) {
          const cx = lx < pr ? pr : pw - pr
          const cy = ly < pr ? pr : ph - pr
          if (Math.hypot(lx - cx, ly - cy) > pr) continue
        }
        blend(px, py)
      }
  }

  // Eyes
  disc(13.5, 13, 2.5)
  disc(26.5, 13, 2.5)
  // Smile arc (doubles as T crossbar)
  strokeQuad(8, 20, 20, 30, 32, 20, 3.8)
  // T stem
  fillRect(18, 20, 4, 13, 2)

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size, scaleFactor: 2 })
  img.setTemplateImage(true)
  return img
}

function updateTray(): void {
  if (!tray) return
  try {
    const stats = getTrayStats()
    const todayCostStr = `$${stats.todayCost.toFixed(4)}`
    const cacheStr = `${(stats.cacheHit7d * 100).toFixed(0)}%`
    const week7dStr = `$${stats.totalCost7d.toFixed(3)}`

    tray.setToolTip(`TokenUsage — Today: ${todayCostStr} · ${stats.todaySessions} sessions`)

    const menu = Menu.buildFromTemplate([
      { label: 'TokenUsage', enabled: false },
      { type: 'separator' },
      { label: `Today:  ${todayCostStr}  (${stats.todaySessions} sessions)`, enabled: false },
      { label: `7-day:  ${week7dStr}`, enabled: false },
      { label: `Cache hit (7d):  ${cacheStr}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Open TokenUsage',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          } else {
            createWindow()
          }
        }
      },
      {
        label: 'Refresh',
        click: () => { notifyRenderer() }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setContextMenu(menu)
  } catch {
    // DB may not be ready yet
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

let notifyRenderer: () => void

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claudeinsight.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()

  notifyRenderer = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('data-updated')
    }
    updateTray()
  }

  setRefreshCallback(notifyRenderer)
  registerIpcHandlers(ipcMain)
  startWatcher(notifyRenderer)

  // Dock icon (macOS)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(drawHappyTIcon(512))
  }

  // System tray — monochrome template icon, macOS handles dark/light inversion
  tray = new Tray(drawTrayTemplateIcon())
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    else createWindow()
  })
  updateTray()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
