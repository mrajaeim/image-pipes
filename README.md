# Image Pipes

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-mrajaeim%2Fimage--pipes-181717?logo=github)](https://github.com/mrajaeim/image-pipes)

**A visual IDE for computer vision pipelines.**

Build, debug, and export OpenCV workflows without writing preprocessing code by hand.

## Why Image Pipes?

Computer vision preprocessing is usually hidden inside long Python scripts. Changing the pipeline often means editing code, re-running everything, and debugging intermediate images manually.

Image Pipes makes that process visual: compose an OpenCV DAG in the browser, execute it live, inspect every step, and export runnable Python when you’re ready.

It is useful for:

- experimenting with preprocessing techniques
- debugging computer vision pipelines
- teaching OpenCV concepts
- rapidly prototyping image workflows
- exporting pipelines into production-ready Python code

## Features

- Drag-and-drop OpenCV nodes (color, filters, morphology, contours, histograms, clustering, and more)
- **Albumentations augment** nodes (catalog-driven) with multi-target ports: image, optional mask, bboxes, keypoints
- Live WebSocket execution with per-node previews, timings, and an execution log
- Result caching and seeded stochastic nodes for reproducible experiments
- **Run to selected** — execute only ancestors of a node while tuning parameters
- **Starters** palette group for source nodes (Load Images, Blank Image, Annotations, …)
- **Export** / **Load** workflow JSON; **Templates** gallery includes Blur & Canny, Hist Equalize, Morphology, Contours, and Albu Augment
- **Export Python** to a standalone script in the Monaco panel
- Catalog-driven UI — the frontend does not hard-code nodes; `/api/nodes` metadata builds the palette automatically

## Architecture highlights

Capabilities that matter beyond “React + OpenCV”:

- DAG-based execution engine with topological validation
- Metadata-driven UI (dynamic node registration)
- Live WebSocket progress, previews, and per-node duration
- Deterministic execution with seeded randomness
- Result caching across runs
- Code generation (`emit_python` → standalone script)
- Full-stack architecture: React Flow editor + FastAPI + OpenCV

## Stack

- **Frontend:** React 19, Vite, TypeScript, MUI, React Flow, Zustand, TanStack Query, React Hook Form, Zod, Monaco
- **Backend:** FastAPI, OpenCV, NumPy, Pillow, Albumentations 2.0.8 (MIT), Pydantic v2, WebSockets
- **Desktop:** Electron + PyInstaller backend sidecar (optional installer)
- **Tooling:** `uv`, `npm`, optional Docker

## Demo

> **Tip:** A short GIF of canvas editing → Run → previews → Export Python converts more visitors than any feature list. Record from the local app and drop files under `docs/demo/` (e.g. `edit.gif`, `run.gif`, `export.gif`), then link them here.

## Desktop app (recommended for end users)

Image Pipes can run as a single **Electron** desktop app. The window starts the Python backend for you and opens the UI—no separate terminals.

### Build an installer

Requires [Node.js](https://nodejs.org/) and [uv](https://docs.astral.sh/uv/):

```bash
npm run install:all
npm run build:desktop
```

Installers are written to `desktop/release/` (NSIS on Windows, DMG on macOS, AppImage on Linux). See [`desktop/README.md`](desktop/README.md).

### Run the desktop shell in development

```bash
cd frontend && npm run build && cd ..
cd backend && uv sync && cd ..
npm --prefix desktop install
npm run desktop
```

## Local development (browser)

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` and `/ws` to the FastAPI server.

### Quality checks

```bash
# backend
cd backend
uv run ruff check
uv run pytest

# frontend
cd frontend
npm run typecheck
npm run lint
```

## Production (single process)

Build the frontend, then serve it from FastAPI:

```bash
cd frontend && npm run build && cd ../backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker compose up --build
```

## Usage

1. Drag nodes from the **Starters** / palette onto the canvas (or click **Example**).
2. Connect matching port types (image / mask / bboxes / keypoints), select a node, and edit parameters in the inspector.
3. For **Load Images**, pick files or a folder (uploaded to the backend).
4. For augmentation with labels, add an **Annotations** starter (Pascal VOC bboxes + xy keypoints) and optionally wire a mask image into the `mask` port.
5. Click **Run** for the full graph, or **Run to selected** / node menu **Run to here** for a partial DAG.
6. Watch live previews (bboxes/keypoints are overlaid on the image) and the execution log.
7. Use **Export** / **Load** for workflow JSON; **Export Python** for a standalone script.
8. Open **About** (info button next to the brand) for license and GitHub.

Example workflows live under [`backend/examples/`](backend/examples/) (e.g. Blur & Canny, Albu Augment, HSV Color Mask, CLAHE & Sharpen, K-Means Palette; image: [`lena.png`](backend/examples/lena.png)).

## Albumentations augments

The **augment** palette category exposes Albumentations transforms via a backend catalog (color, blur/noise, weather, normalize/channels, and dual geometry). Every augment node shares the same ports:

| Port | Required | Notes |
|------|----------|--------|
| `image` | yes | OpenCV BGR; converted to RGB for Albumentations |
| `mask` | no | Same H×W; stays aligned under Dual transforms |
| `bboxes` | no | Pascal VOC `[x_min, y_min, x_max, y_max, label]` |
| `keypoints` | no | `[x, y]` lists |

Image-only transforms pass annotations through unchanged. Dual geometry transforms (flips, rotates, affine, crops, …) update mask/bboxes/keypoints together. Runs are seeded from the global seed / sample index.

**Dependency note:** Image Pipes pins the MIT-licensed [`albumentations==2.0.8`](https://pypi.org/project/albumentations/2.0.8/) package so this project stays MIT-clean. The newer maintained `albumentationsx` line is AGPL and is intentionally not used here.

## Adding a node

See [docs/architecture.md](docs/architecture.md) for the registration guide. In short:

1. Subclass `BaseNode` in `backend/app/nodes/`.
2. Implement `execute()` and `emit_python()`.
3. Register the instance in `backend/app/nodes/__init__.py`.

No frontend changes are required beyond what the `/api/nodes` metadata already drives.

## License

This project is licensed under the [MIT License](LICENSE).
