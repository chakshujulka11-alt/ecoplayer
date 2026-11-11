import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { getDatabase } from '../db/connection'
import { registerIpcHandlers } from './ipc'
import { registerMediaProtocol } from './media-protocol'

let mainWindow: BrowserWindow | null = null

// Deterministic identity + data location in every launch mode
// (vite dev, unpacked `electron out/main`, installed, portable).
// MYOWNPLAYER_USERDATA overrides the location (used by automated tests).
app.setName('Eco Player')
app.setPath('userData', process.env.ECOPLAYER_USERDATA ?? path.join(app.getPath('appData'), 'Eco Player'))

function createWindow(): void {
  const isWindows = process.platform === 'win32'
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Eco Player',
    backgroundColor: '#09090b',
    ...(isWindows
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: '#09090b', symbolColor: '#e4e4e7', height: 36 }
        }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, '../preload/index.js')
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startup(): void {
  registerMediaProtocol()
  // Initialize the library database before the window loads.
  getDatabase()
  registerIpcHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

void app.whenReady().then(startup).catch((err: unknown) => {
  console.error('Failed to start Eco Player:', err instanceof Error ? err.message : err)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
