#!/usr/bin/env node
/**
 * Build pipeline for the Image Pipes desktop app:
 * 1) frontend production build
 * 2) PyInstaller backend sidecar
 * 3) stage into desktop/resources/server
 * 4) sync desktop version from git tag (when available)
 * 5) electron-builder installer
 */
import { execSync, spawn } from 'node:child_process'
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

/** Strip leading `v` from a git tag (v0.2.0 → 0.2.0). */
function stripVersionPrefix(tag) {
  return tag.trim().replace(/^v/i, '')
}

/**
 * Resolve the desktop app version from (in order):
 * 1) IMAGE_PIPES_VERSION env
 * 2) GITHUB_REF tag (CI tag builds)
 * 3) nearest git tag (`git describe --tags --abbrev=0`)
 * Returns null when nothing usable is found.
 */
function resolveDesktopVersion() {
  const override = process.env.IMAGE_PIPES_VERSION?.trim()
  if (override) return stripVersionPrefix(override)

  const ref = process.env.GITHUB_REF ?? ''
  if (ref.startsWith('refs/tags/')) {
    return stripVersionPrefix(ref.slice('refs/tags/'.length))
  }

  try {
    const tag = execSync('git describe --tags --abbrev=0', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (tag) return stripVersionPrefix(tag)
  } catch {
    // Untagged clone / shallow checkout without tags.
  }
  return null
}

/** Write resolved version into desktop/package.json for electron-builder. */
function syncDesktopPackageVersion(desktopDir) {
  const version = resolveDesktopVersion()
  const pkgPath = path.join(desktopDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

  if (!version) {
    console.log(
      `==> No git tag version found; keeping desktop/package.json at ${pkg.version}`,
    )
    return pkg.version
  }

  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(
      `Invalid desktop version "${version}" (expected semver like 0.2.0)`,
    )
  }

  if (pkg.version === version) {
    console.log(`==> Desktop version already ${version}`)
    return version
  }

  console.log(`==> Setting desktop version to ${version} (from git tag)`)
  pkg.version = version
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  return version
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

  const version = syncDesktopPackageVersion(desktopDir)

  console.log(`==> Building Electron installer (v${version})`)
  await run('npm', ['run', 'dist'], desktopDir)

  console.log('\nDesktop build complete. Installers are under desktop/release/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
