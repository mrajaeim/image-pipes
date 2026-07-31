#!/usr/bin/env node
/**
 * Build pipeline for the Image Pipes desktop app:
 * 1) frontend production build
 * 2) PyInstaller backend sidecar
 * 3) stage into desktop/resources/server
 * 4) electron-builder installer
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: isWin,
      env: process.env,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

async function main() {
  const skipInstaller = process.argv.includes('--sidecar-only')
  const frontendDir = path.join(root, 'frontend')
  const backendDir = path.join(root, 'backend')
  const desktopDir = path.join(root, 'desktop')
  const resourcesServer = path.join(desktopDir, 'resources', 'server')
  const pyDist = path.join(backendDir, 'dist', 'image-pipes-server')

  console.log('==> Installing frontend dependencies')
  const npmInstall = process.env.CI === 'true' ? ['ci'] : ['install']
  await run('npm', npmInstall, frontendDir)

  console.log('==> Building frontend')
  await run('npm', ['run', 'build'], frontendDir)

  console.log('==> Syncing backend (incl. PyInstaller)')
  await run('uv', ['sync', '--group', 'dev'], backendDir)

  console.log('==> Freezing backend sidecar with PyInstaller')
  rimraf(path.join(backendDir, 'build'))
  rimraf(path.join(backendDir, 'dist'))
  await run(
    'uv',
    ['run', 'pyinstaller', '--noconfirm', '--clean', 'image_pipes_server.spec'],
    backendDir,
  )

  if (!fs.existsSync(pyDist)) {
    throw new Error(`PyInstaller output missing: ${pyDist}`)
  }

  console.log('==> Staging desktop/resources/server')
  rimraf(resourcesServer)
  copyDir(pyDist, resourcesServer)

  // Ensure frontend dist is present next to the sidecar for IMAGE_PIPES_FRONTEND_DIST.
  const stagedFrontend = path.join(resourcesServer, 'frontend', 'dist')
  if (!fs.existsSync(stagedFrontend)) {
    copyDir(path.join(frontendDir, 'dist'), stagedFrontend)
  }

  // Examples for Load Image template paths (cwd is server dir).
  const examplesSrc = path.join(backendDir, 'examples')
  const examplesDest = path.join(resourcesServer, 'examples')
  if (fs.existsSync(examplesSrc) && !fs.existsSync(examplesDest)) {
    copyDir(examplesSrc, examplesDest)
  }

  if (skipInstaller) {
    console.log('==> Sidecar staged. Skipping electron-builder (--sidecar-only).')
    return
  }

  console.log('==> Installing desktop dependencies')
  await run('npm', npmInstall, desktopDir)

  console.log('==> Building Electron installer')
  await run('npm', ['run', 'dist'], desktopDir)

  console.log('\nDesktop build complete. Installers are under desktop/release/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
