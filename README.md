# Image Pipeline Playground

Visual node editor for OpenCV image-preprocessing pipelines. Build a DAG in the browser, execute it with caching and live previews, and export a runnable Python script.

## Stack

- **Frontend:** React 19, Vite, TypeScript, MUI, React Flow, Zustand, TanStack Query, React Hook Form, Zod, Monaco
- **Backend:** FastAPI, OpenCV, NumPy, Pillow, Pydantic v2, WebSockets
- **Tooling:** `uv`, `npm`, optional Docker

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

1. Drag nodes from the palette onto the canvas.
2. Connect ports, select a node, and edit parameters in the inspector.
3. For `Load Image`, set `path` to a file accessible by the backend (for example `uploads/input.png`).
4. Click **Run** to execute over WebSocket and watch previews fill in.
5. Click **Export Python** to fill the Monaco panel with a standalone script.

Example graph JSON lives in [`backend/examples/blur_canny.json`](backend/examples/blur_canny.json).

## Adding a node

See [docs/architecture.md](docs/architecture.md) for the registration guide. In short:

1. Subclass `BaseNode` in `backend/app/nodes/`.
2. Implement `execute()` and `emit_python()`.
3. Register the instance in `backend/app/nodes/__init__.py`.

No frontend changes are required beyond what the `/api/nodes` metadata already drives.
