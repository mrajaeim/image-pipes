# Image Pipes

A visual workflow editor for computer vision pipelines powered by **OpenCV** and **Albumentations**.

Instead of writing hundreds of lines of preprocessing code, build your image processing pipeline visually, inspect every intermediate transformation in real time, and export clean, production-ready Python code.

---

## 📚 Table of Contents

- [Overview](#overview)
- [Demo](#demo)
- [Why Image Pipes?](#why-image-pipes)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Docker Setup](#docker-setup)
- [Quality Checks](#quality-checks)
- [Adding a New Node](#adding-a-new-node)
- [Exporting Code](#exporting-code)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)

---

# Overview

Image Pipes is a visual workflow editor for computer vision powered by **OpenCV** and **Albumentations**.

Instead of writing hundreds of lines of boilerplate preprocessing scripts, you compose your workflow visually, inspect intermediate frame transformations in real time, and export deterministic, production-ready Python code.

```text
┌──────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Load Image  │ ──► │  Grayscale   │ ──► │ Gaussian Blur │ ──► │    Canny     │
└──────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                                                                        │
                                                                        ▼
                                                                ┌──────────────┐
                                                                │ Find Contours│
                                                                └──────────────┘
```

---

# Demo

> [!NOTE]
> **Demo Coming Soon**

A short GIF/video will showcase:

- **Frontend:** React 19, Vite, TypeScript, MUI, React Flow, Zustand, TanStack Query, React Hook Form, Zod, Monaco
- **Backend:** FastAPI, OpenCV, NumPy, Pillow, Albumentations 2.0.8 (MIT), Pydantic v2, WebSockets
- **Desktop:** Electron + PyInstaller backend sidecar (optional installer)
- **Tooling:** `uv`, `npm`, optional Docker

---

# Why Image Pipes?

## Desktop app (recommended for end users)

Image Pipes can run as a single **Electron** desktop app. The window starts the Python backend for you and opens the UI—no separate terminals.

### Build an installer

Requires [Node.js](https://nodejs.org/) and [uv](https://docs.astral.sh/uv/):

```bash
npm run install:all
npm run build:desktop
```

Installers are written to `desktop/release/` (NSIS on Windows, DMG on macOS, AppImage on Linux). See [`desktop/README.md`](desktop/README.md).

CI builds installers on every push/PR to `main` (and on `workflow_dispatch`) via [`.github/workflows/desktop.yml`](.github/workflows/desktop.yml). Push a `v*` tag to publish a GitHub Release with the artifacts.

### Run the desktop shell in development

```bash
cd frontend && npm run build && cd ..
cd backend && uv sync && cd ..
npm --prefix desktop install
npm run desktop
```

## Local development (browser)

1. Edit Python script
2. Run the program
3. Save temporary images
4. Compare outputs
5. Tune parameters
6. Repeat dozens of times

## Traditional Workflow vs Image Pipes

| Traditional | Image Pipes |
|------------|-------------|
| Hundreds of lines of boilerplate | Visual node graph |
| `cv2.imshow()` debugging | Live previews |
| Manual parameter tuning | Interactive controls |
| Hidden intermediate states | Inspect every node |
| Script-only workflow | Export clean Python code |

---

# Key Features

## 🎨 Visual Workflow Editor

- React Flow powered canvas
- Smooth zoom & pan
- Dynamic grid snapping
- Automatic connection validation
- Rich node controls
  - sliders
  - dropdowns
  - switches
  - numeric inputs

---

## 👁️ Real-Time Preview

- Low-latency WebSocket execution
- Live intermediate images
- Bounding box overlays
- Mask visualization
- Keypoint visualization
- Execution timing
- Runtime logs

---

## 🧪 Rich Processing Library

### OpenCV

- Color conversions
- Blur & filtering
- Thresholding
- Morphological operations
- Histograms
- Edge detection
- Contours
- Geometric transforms
- K-Means clustering

### Albumentations

Supports:

- Image transforms
- Bounding boxes
- Segmentation masks
- Keypoints
- Multi-target augmentation

Deterministic seeded execution enables reproducible experiments.

---

## ⚡ Smart Execution Engine

- DAG validation
- Topological sorting
- Partial execution
- Run-to-selected-node
- In-memory caching
- Incremental recomputation

---

## 📦 Metadata-Driven Design

New processing nodes are automatically discovered.

Adding a backend node requires **zero frontend changes**.

Features include:

- Automatic node discovery
- Dynamic UI generation
- JSON workspace import/export

---

# How It Works

```text
Image
   │
   ▼
Visual Graph
   │
   ▼
Validate DAG
   │
   ▼
Execute Nodes
   │
   ▼
Preview Every Step
   │
   ▼
Export Native Python
```

---

# Architecture

```text
                       ┌─────────────────────────┐
                       │    React Flow Editor    │
                       └────────────┬────────────┘
                                    │
                            WebSocket / REST
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │  DAG Execution Engine   │
                       └────────────┬────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
   ┌────────────────────┐                      ┌────────────────────┐
   │    OpenCV Nodes    │                      │   Albumentations   │
   └──────────┬─────────┘                      └──────────┬─────────┘
              │                                           │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │   Previews & Export     │
                       └────────────┬────────────┘
```

---

# Tech Stack

## Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | UI |
| TypeScript | Type safety |
| Vite | Build tool |
| React Flow | Graph editor |
| Zustand | State management |
| TanStack Query | Server state |
| Material UI | Components |
| Monaco Editor | Code editor |
| React Hook Form | Forms |
| Zod | Validation |

---

## Backend

| Technology | Purpose |
|------------|---------|
| FastAPI | API |
| WebSockets | Live execution |
| Pydantic v2 | Data validation |
| OpenCV | Image processing |
| Albumentations | Data augmentation |
| Pillow | Image loading |
| NumPy | Numerical operations |
| Custom DAG Engine | Workflow execution |

---

## Tooling

- Python 3.12+
- uv
- Node.js 20+
- npm
- Docker
- Docker Compose

---

# Quick Start

## Prerequisites

- Python **3.12+**
- Node.js **20+**
- **uv** (recommended)

---

## Backend Setup

```bash
cd backend

uv sync

uv run uvicorn app.main:app \
    --reload \
    --port 8000
```

Verify backend:

```
http://127.0.0.1:8000/api/health
```

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Open:

```
http://127.0.0.1:5173
```

The Vite development server automatically proxies:

- `/api`
- `/ws`

to the backend.

Or with Docker (single container serves UI + API on port 8000):

```bash
docker compose up --build
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Persistent cache/uploads/outputs use named volumes. Image builds are verified in CI by [`.github/workflows/docker.yml`](.github/workflows/docker.yml).

## Usage

# Quality Checks

## Backend

```bash
cd backend

uv run ruff check

uv run pytest
```

## Frontend

```bash
cd frontend

npm run lint

npm run typecheck
```

---

# Adding a New Node

Image Pipes uses a metadata-driven architecture.

Adding a custom node requires **zero frontend modifications**.

## 1. Create a Node

```python
from app.nodes.base import BaseNode
import cv2

class GaussianBlurNode(BaseNode):
    category = "Filters"
    display_name = "Gaussian Blur"

    def execute(self, inputs: dict, params: dict):
        kernel_size = params.get("kernel_size", 5)
        k = kernel_size if kernel_size % 2 else kernel_size + 1
        output = cv2.GaussianBlur(inputs["image"], (k, k), 0)
        return {"image": output}

    def emit_python(self, inputs, params):
        k = params.get("kernel_size", 5)
        return (
            f"blurred = cv2.GaussianBlur("
            f"{inputs['image']}, ({k}, {k}), 0)"
        )
```

---

## 2. Register the Node

Register it in the node catalog.

The frontend automatically:

- discovers the node
- renders its controls
- exposes it in the palette

No frontend code changes required.

> [!TIP]
> See `docs/architecture.md` for the complete node schema.

---

# Exporting Code

Image Pipes generates standalone Python without proprietary runtime dependencies.

```python
import cv2

image = cv2.imread("input.jpg")

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
blur = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blur, 50, 150)

cv2.imwrite("output_edges.png", edges)
```

---

# Roadmap

- [ ] Video pipeline support
- [ ] Camera streaming
- [ ] ONNX Runtime nodes
- [ ] PyTorch inference nodes
- [ ] Custom Python nodes
- [ ] CUDA acceleration
- [ ] Batch processing
- [ ] Plugin SDK
- [ ] Cloud workspace synchronization

---

# Contributing

Contributions are welcome!

```bash
# Fork the repository

# Create a feature branch
git checkout -b feature/amazing-node

# Commit your changes
git commit -m "Add custom threshold node"

# Push
git push origin feature/amazing-node
```

Then open a Pull Request.

For larger changes, please open an issue first to discuss the proposal.

---

# FAQ

### Is Image Pipes only a visual wrapper?

No.

The exported pipeline consists entirely of standard Python and OpenCV code and runs independently without Image Pipes installed.

---

### Does it support bounding boxes and segmentation masks?

Yes.

Albumentations dual transforms automatically keep:

- bounding boxes
- segmentation masks
- keypoints

synchronized throughout the pipeline.

---

### Can I use it offline?

Yes.

Everything runs locally on your machine.

---

# License

Distributed under the **MIT License**.

See the **LICENSE** file for details.
