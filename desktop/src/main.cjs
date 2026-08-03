const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const fs = require('node:fs')

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff', 'webp', 'gif']

const DEFAULT_BACKEND_PORT = 8000
const DEFAULT_VITE_PORT = 5173
/** Vite HMR UI — only when launched with `electron . --dev` (npm run desktop). */
const useViteDev = process.argv.includes('--dev') && !app.isPackaged
const isDev = useViteDev || !app.isPackaged

/** @type {import('node:child_process').ChildProcess | null} */
let backendProcess = null
/** @type {import('node:child_process').ChildProcess | null} */
let viteProcess = null
/** @type {BrowserWindow | null} */
let mainWindow = null
let backendPort = DEFAULT_BACKEND_PORT
let vitePort = DEFAULT_VITE_PORT

function repoRoot() {
  // desktop/src -> desktop -> repo
  return path.resolve(__dirname, '..', '..')
}

function serverBinaryName() {
  return process.platform === 'win32' ? 'image-pipes-server.exe' : 'image-pipes-server'
}

function packagedServerPath() {
  return path.join(process.resourcesPath, 'server', serverBinaryName())
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer()
      server.unref()
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && port < startPort + 40) {
          tryPort(port + 1)
        } else {
          reject(error)
        }
      })
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port))
      })
    }
    tryPort(startPort)
  })
}

function waitForHttpOk(port, pathName, label, timeoutMs = 90000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: pathName, timeout: 1500 },
        (res) => {
          res.resume()
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            resolve()
            return
          }
          retry()
        },
      )
      req.on('error', retry)
      req.on('timeout', () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`${label} did not become ready in time`))
        return
      }
      setTimeout(tick, 400)
    }
    tick()
  })
}

function buildBackendEnv(port) {
  const dataDir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const env = {
    ...process.env,
    IMAGE_PIPES_HOST: '127.0.0.1',
    IMAGE_PIPES_PORT: String(port),
    IMAGE_PIPES_DATA_DIR: dataDir,
    IMAGE_PIPES_LOG_LEVEL: isDev ? 'info' : 'warning',
    PYTHONUNBUFFERED: '1',
  }

  // Production / non-Vite desktop: FastAPI serves the built SPA.
  if (!useViteDev) {
    const frontendDist = path.join(repoRoot(), 'frontend', 'dist')
    if (fs.existsSync(frontendDist)) {
      env.IMAGE_PIPES_FRONTEND_DIST = frontendDist
    }
  }

  if (app.isPackaged) {
    const packagedDist = path.join(process.resourcesPath, 'server', 'frontend', 'dist')
    if (fs.existsSync(packagedDist)) {
      env.IMAGE_PIPES_FRONTEND_DIST = packagedDist
    }
  }

  return env
}

function attachProcessLogs(child, label) {
  const log = (chunk) => {
    const text = chunk.toString()
    if (text.trim()) console.log(`[${label}] ${text.trimEnd()}`)
  }
  child.stdout?.on('data', log)
  child.stderr?.on('data', log)
}

function spawnBackend(port) {
  const env = buildBackendEnv(port)
  const cwdBackend = path.join(repoRoot(), 'backend')

  if (app.isPackaged) {
    const binary = packagedServerPath()
    if (!fs.existsSync(binary)) {
      throw new Error(
        `Packaged backend missing at ${binary}. Rebuild with scripts/build-desktop.`,
      )
    }
    backendProcess = spawn(binary, [], {
      cwd: path.dirname(binary),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } else {
    const runServer = path.join(cwdBackend, 'run_server.py')
    backendProcess = spawn('uv', ['run', 'python', runServer], {
      cwd: cwdBackend,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })
  }

  attachProcessLogs(backendProcess, 'backend')
  backendProcess.on('exit', (code, signal) => {
    console.log(`[backend] exited code=${code} signal=${signal}`)
    backendProcess = null
  })
}

function spawnVite(port, apiPort) {
  const frontendDir = path.join(repoRoot(), 'frontend')
  viteProcess = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: frontendDir,
    env: {
      ...process.env,
      IMAGE_PIPES_API_PROXY: `http://127.0.0.1:${apiPort}`,
      IMAGE_PIPES_VITE_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  })

  attachProcessLogs(viteProcess, 'vite')
  viteProcess.on('exit', (code, signal) => {
    console.log(`[vite] exited code=${code} signal=${signal}`)
    viteProcess = null
  })
}

function stopProcess(child) {
  if (!child || child.killed || child.pid == null) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      child.kill('SIGTERM')
    }
  } catch (error) {
    console.error('Failed to stop process', error)
  }
}

function stopChildren() {
  stopProcess(viteProcess)
  viteProcess = null
  stopProcess(backendProcess)
  backendProcess = null
}

function uiUrl() {
  if (useViteDev) return `http://127.0.0.1:${vitePort}`
  return `http://127.0.0.1:${backendPort}`
}

function registerDesktopIpc() {
  ipcMain.handle('desktop:openImages', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Choose images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled) return { canceled: true, paths: [] }
    return { canceled: false, paths: result.filePaths }
  })

  ipcMain.handle('desktop:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Choose image folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('desktop:pickFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: 'Choose output folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  ipcMain.handle('desktop:revealInFolder', async (_event, targetPath) => {
    if (typeof targetPath !== 'string' || !targetPath.trim()) {
      throw new Error('Path is required')
    }
    shell.showItemInFolder(path.resolve(targetPath))
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#0f0f0f',
    title: 'Image Pipes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  await mainWindow.loadURL(uiUrl())

  if (useViteDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function bootstrap() {
  backendPort = await findFreePort(DEFAULT_BACKEND_PORT)
  spawnBackend(backendPort)
  await waitForHttpOk(backendPort, '/api/health', 'Backend')

  if (useViteDev) {
    vitePort = await findFreePort(DEFAULT_VITE_PORT)
    spawnVite(vitePort, backendPort)
    await waitForHttpOk(vitePort, '/', 'Vite')
  }

  await createWindow()
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerDesktopIpc()
  void bootstrap().catch(async (error) => {
    console.error(error)
    stopChildren()
    await dialog.showErrorBox(
      'Image Pipes failed to start',
      `${error instanceof Error ? error.message : String(error)}\n\n` +
        (useViteDev
          ? 'Dev tip: run `uv sync` in backend/ and `npm install` in frontend/.'
          : 'Dev tip: run `uv sync` in backend/ and `npm run build` in frontend/.'),
    )
    app.quit()
  })
})

app.on('before-quit', () => {
  stopChildren()
})

app.on('window-all-closed', () => {
  stopChildren()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && backendProcess) {
    void createWindow()
  }
})
