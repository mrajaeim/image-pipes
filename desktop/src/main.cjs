const { app, BrowserWindow, dialog, Menu, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const fs = require('node:fs')

const DEFAULT_PORT = 8765
const isDev = process.argv.includes('--dev') || !app.isPackaged

/** @type {import('node:child_process').ChildProcess | null} */
let backendProcess = null
/** @type {BrowserWindow | null} */
let mainWindow = null
let backendPort = DEFAULT_PORT

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

function waitForHealth(port, timeoutMs = 90000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/api/health', timeout: 1500 },
        (res) => {
          res.resume()
          if (res.statusCode === 200) {
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
        reject(new Error('Backend did not become healthy in time'))
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

  const frontendDist = path.join(repoRoot(), 'frontend', 'dist')
  if (fs.existsSync(frontendDist)) {
    env.IMAGE_PIPES_FRONTEND_DIST = frontendDist
  }

  if (app.isPackaged) {
    const packagedDist = path.join(process.resourcesPath, 'server', 'frontend', 'dist')
    if (fs.existsSync(packagedDist)) {
      env.IMAGE_PIPES_FRONTEND_DIST = packagedDist
    }
  }

  return env
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
    // Dev / unpackaged: prefer `uv run`, fall back to python.
    const runServer = path.join(cwdBackend, 'run_server.py')
    const uvArgs = ['run', 'python', runServer]
    backendProcess = spawn('uv', uvArgs, {
      cwd: cwdBackend,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })
  }

  const log = (chunk) => {
    const text = chunk.toString()
    if (text.trim()) console.log(`[backend] ${text.trimEnd()}`)
  }
  backendProcess.stdout?.on('data', log)
  backendProcess.stderr?.on('data', log)
  backendProcess.on('exit', (code, signal) => {
    console.log(`[backend] exited code=${code} signal=${signal}`)
    backendProcess = null
  })
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      backendProcess.kill('SIGTERM')
    }
  } catch (error) {
    console.error('Failed to stop backend', error)
  }
  backendProcess = null
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

  const url = `http://127.0.0.1:${backendPort}`
  await mainWindow.loadURL(url)

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function bootstrap() {
  backendPort = await findFreePort(DEFAULT_PORT)
  spawnBackend(backendPort)
  await waitForHealth(backendPort)
  await createWindow()
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  void bootstrap().catch(async (error) => {
    console.error(error)
    stopBackend()
    await dialog.showErrorBox(
      'Image Pipes failed to start',
      `${error instanceof Error ? error.message : String(error)}\n\n` +
        'Dev tip: run `uv sync` in backend/ and `npm run build` in frontend/.',
    )
    app.quit()
  })
})

app.on('before-quit', () => {
  stopBackend()
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && backendProcess) {
    void createWindow()
  }
})
