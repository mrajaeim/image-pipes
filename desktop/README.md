# Image Pipes — Desktop (Electron)

One-window desktop app: Electron starts the FastAPI backend, waits for health, then loads the UI.

## Easy path for users

Build an installer (Windows NSIS / macOS DMG / Linux AppImage), then distribute `desktop/release/*`.

```bash
# from repo root — needs Node.js, npm, and uv
npm run install:all
npm run build:desktop
```

Installers land in `desktop/release/`. End users do **not** need Python or Node.

GitHub Actions builds Windows / Linux / macOS installers on `main` and publishes them when you push a `v*` tag (see `.github/workflows/desktop.yml`).

## Developer day-to-day

Terminal A — not required if you use the desktop shell:

```bash
cd backend && uv sync && uv run python run_server.py
cd frontend && npm run build   # once, so FastAPI can serve the UI
```

Or run everything from Electron (spawns `uv run python run_server.py` for you):

```bash
cd frontend && npm run build
cd ../backend && uv sync
cd ../desktop && npm install
cd .. && npm run desktop
```

`npm run desktop` launches Electron with `--dev` (opens DevTools).

## What gets packaged

1. Vite production build → `frontend/dist`
2. PyInstaller onedir sidecar → `desktop/resources/server/image-pipes-server(.exe)`
3. electron-builder wraps Electron + sidecar + examples

Runtime data (cache, uploads, downloads) goes under the OS userData folder, not Program Files.
