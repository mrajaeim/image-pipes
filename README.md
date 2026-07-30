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
- Live WebSocket execution with per-node previews, timings, and an execution log
- Result caching and seeded stochastic nodes for reproducible experiments
- **Run to selected** — execute only ancestors of a node while tuning parameters
- **Starters** palette group for source nodes (Load Images, Blank Image, …)
- **Export** / **Load** workflow JSON; **Example** loads the bundled Lena blur→Canny pipeline
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
- **Backend:** FastAPI, OpenCV, NumPy, Pillow, Pydantic v2, WebSockets
- **Tooling:** `uv`, `npm`, optional Docker

## Demo

> **Tip:** A short GIF of canvas editing → Run → previews → Export Python converts more visitors than any feature list. Record from the local app and drop files under `docs/demo/` (e.g. `edit.gif`, `run.gif`, `export.gif`), then link them here.

## Local development

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
2. Connect ports, select a node, and edit parameters in the inspector.
3. For **Load Images**, pick files or a folder (uploaded to the backend).
4. Click **Run** for the full graph, or **Run to selected** / node menu **Run to here** for a partial DAG.
5. Watch live previews and the execution log (per-node timings).
6. Use **Export** / **Load** for workflow JSON; **Export Python** for a standalone script.
7. Open **About** (info button next to the brand) for license and GitHub.

Example workflow: [`backend/examples/blur_canny.json`](backend/examples/blur_canny.json) (uses [`backend/examples/lena.png`](backend/examples/lena.png)).

## Adding a node

See [docs/architecture.md](docs/architecture.md) for the registration guide. In short:

1. Subclass `BaseNode` in `backend/app/nodes/`.
2. Implement `execute()` and `emit_python()`.
3. Register the instance in `backend/app/nodes/__init__.py`.

No frontend changes are required beyond what the `/api/nodes` metadata already drives.

## License

This project is licensed under the [MIT License](LICENSE).
