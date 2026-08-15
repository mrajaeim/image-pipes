<div align="center">

# 🎨 Image Pipes

### Stop scripting. Start seeing.

**Build computer vision pipelines visually — inspect every pixel transformation in real time, then export clean, production-ready Python the moment you're happy with the result.**

<p>
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?logo=opencv&logoColor=white" />
  <img src="https://img.shields.io/badge/Albumentations-Data%20Augmentation-FF4B4B" />
  <img src="https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-success" />
</p>

**⚡ Build • Preview • Experiment • Export**

[Download](https://github.com/mrajaeim/image-pipes/releases) •
[Demo](#-demo) •
[Features](#-features) •
[Architecture](#-architecture) •
[Docs](#-docs) •
[Quick Start](#-quick-start) •
[Roadmap](#-roadmap)

</div>

## 🚀 Experience the Workflow

<table>
<tr>
<td width="65%">

<img src="https://github.com/user-attachments/assets/fb73deff-cdf7-4a1d-8893-074dab5e8107">

</td>

<td width="35%">

### Visual Editor

- 🎯 Drag & Drop Nodes
- ⚡ Instant Execution
- 👀 Live Image Preview
- 🧠 OpenCV & Albumentations
- 🐍 Custom Python & reusable scripts
- 📦 Export Python Code

</td>
</tr>
</table>

---

<table>
<tr>
<td align="center">

<img src="https://github.com/user-attachments/assets/0222a5f5-d2c1-4803-bb52-72b05c245f6c">

### Dataset Augmentation

Create hundreds of augmentations visually.

</td>

<td align="center">

<img src="https://github.com/user-attachments/assets/aa2c1833-1ce1-4fd7-8a5a-d6f95058d2ff">

### Pipeline Templates

Build reusable computer vision pipelines.

</td>
</tr>
</table>

---

## 💭 The Problem

If you've built a computer vision pipeline before, this loop probably feels familiar:

```text
tweak a parameter → run the script → save an image → open it → squint → repeat
```

Each iteration costs you a context switch. Multiply that by every blur kernel, every threshold value, every augmentation you're tuning, and "quick experiment" turns into an afternoon lost to `cv2.imshow()` windows and throwaway debug scripts.

**Image Pipes breaks the loop.** Assemble your pipeline as a graph, watch every node's output update live, and walk away with production Python — not a black box you're locked into forever.

```text
┌──────────────┐
│ Load Image   │
└──────┬───────┘
       ▼
┌──────────────┐
│ Resize       │
└──────┬───────┘
       ▼
┌──────────────┐
│ Grayscale    │
└──────┬───────┘
       ▼
┌──────────────┐
│ GaussianBlur │
└──────┬───────┘
       ▼
┌──────────────┐
│ Threshold    │
└──────┬───────┘
       ▼
┌──────────────┐
│ FindContours │
└──────┬───────┘
       ▼
 Production Python 🐍
```

---

## ✨ Features

### 🎨 A Canvas, Not a Console

Assemble pipelines by dragging nodes onto an infinite canvas powered by React Flow. Connect them, configure them through rich auto-generated property panels, and let built-in validation catch mistakes before you ever hit "run."

- Drag & drop nodes with smart, type-aware connections
- Infinite canvas with smooth zoom & pan
- Dynamic property panels generated straight from node metadata
- Real-time validation as you build

### ⚡ Real-Time Preview, Every Step

Every node executes independently, so you can inspect a transformation the instant it happens — no more mentally simulating what five chained `cv2` calls did to your image.

See, live, at every node:

- Intermediate image outputs
- Bounding boxes, segmentation masks, and keypoints
- Execution time per node
- Runtime logs
- **Script log** lines from custom / reusable Python (`log(...)`)

### 🐍 Custom Python & Reusable Scripts

Drop a **Custom Python** node when a built-in transform isn't enough. Author `process(image, seed=0)` in the Monaco editor with `cv2`, `numpy`, and Image Pipes helpers available in scope:

```python
def process(image, seed=0):
    # log(...) appears in the inspector Script log panel
    log("input", image, "seed=", seed)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
```

**Trust before run.** Workflows that include custom code are blocked until you review and confirm — trust is session-only and never written into exported workflow JSON.

**Save as a reusable node.** Promote inline code into a named palette entry under **My Scripts**. Scripts are versioned on disk (`v1`, `v2`, …); canvas nodes pin a version so older pipelines keep running the code they were saved with. Editing always creates a new version instead of overwriting history.

Helpers (starting with `log(*args)`) are documented in-app from the inspector **Helpers** dialog — more runtime helpers will land there over time. For on-disk layout of reusable scripts and the trust model, see [Data locations](docs/data-locations.md) and [Architecture](docs/architecture.md).

### 🧠 A Smart Execution Engine Under the Hood

Pipelines aren't run top-to-bottom blindly. Image Pipes compiles your graph into a **Directed Acyclic Graph (DAG)**, topologically sorts it, and executes only what actually needs to run.

- Incremental execution & partial recomputation
- Run-to-selected-node for fast, targeted debugging
- In-memory caching so large pipelines stay snappy
- Full DAG validation before execution

The result: pipelines with dozens of nodes stay responsive, not sluggish.

### 📦 Metadata-Driven Architecture

Adding a new backend node automatically makes it available in the editor — forms, controls, categories, and validation are all generated for free. **Zero frontend work required.** Implement the node, and the UI builds itself around it.

### 🧪 A Serious Computer Vision Toolbox

Powered by industry-standard libraries, not reinvented wheels.

**OpenCV** gives you the full classical CV toolkit:

- Color conversions, blur & filtering, edge detection
- Histograms, morphology, geometric transforms
- Contours, thresholding, K-Means, and much more

**Albumentations powers first-class data augmentation** right inside the visual graph. Chain augmentations like flips, rotations, color jitter, noise, cutout, and elastic transforms alongside your preprocessing nodes — all while correctly propagating:

- Images
- Bounding boxes
- Segmentation masks
- Keypoints

Every run is deterministic and seedable, so your augmented datasets are fully reproducible across teammates and experiments — critical for anyone training a model on top of this pipeline.

### 🐍 Your Pipeline Is Never Trapped

Design visually, but never get locked in. Export readable, standalone Python built on OpenCV and Albumentations — no proprietary runtime, no generated framework, nothing that only works inside Image Pipes.

```python
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
blur = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blur, 50, 150)
```

That's it. That's the export. Drop it straight into your training pipeline, your ETL job, or a notebook.

---

## 🚀 Use Cases

Image Pipes fits naturally into workflows like:

- Dataset preprocessing for ML training
- Building and tuning data augmentation pipelines with Albumentations
- Teaching computer vision concepts visually
- Rapid OpenCV experimentation and prototyping
- Dropping in one-off Custom Python steps (with a trust gate) without leaving the canvas
- Saving reusable, versioned script nodes for your own toolbox
- Research reproducibility (deterministic, versionable pipelines)
- Debugging annotation pipelines (boxes, masks, keypoints)
- General image analysis and exploration

---

## 🏗 Architecture

```text
                     React Flow Editor
                             │
                    REST + WebSockets
                             │
                             ▼
                  DAG Execution Engine
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
        OpenCV Processing  Albumentations  Custom / user scripts
         (classical CV)   (augmentation)   (process + log helpers)
               │             │             │
               └─────────────┴──────┬──────┘
                                    │
                                    ▼
                         Live Preview & Export
                                    │
                                    ▼
                           Standalone Python
```

---

## 📚 Docs

| Guide | What it covers |
|-------|----------------|
| [Architecture & node registration](docs/architecture.md) | DAG layers, registering nodes, Custom Python trust gate |
| [Data locations](docs/data-locations.md) | Cache, uploads, outputs, assets, and versioned `user_scripts/` on disk (Electron vs backend) |

Also see the desktop notes in [desktop/README.md](desktop/README.md).

---

## 🛠 Tech Stack

<table>
<tr>
<td valign="top">

**Frontend**
- React 19 + TypeScript
- Vite
- React Flow
- Zustand
- TanStack Query
- Material UI
- Monaco Editor
- React Hook Form + Zod

</td>
<td valign="top">

**Backend**
- FastAPI
- OpenCV
- Albumentations
- NumPy
- Pillow
- WebSockets
- Pydantic v2

</td>
<td valign="top">

**Desktop**
- Electron

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Download

Grab the latest desktop installer (Windows, macOS, or Linux) from the [Releases](https://github.com/mrajaeim/image-pipes/releases) page — no Python or Node required.

### From source

Clone the repository:

```bash
git clone https://github.com/mrajaeim/image-pipes.git
cd image-pipes
```

Install everything:

```bash
npm run install:all
```

Launch the desktop app:

```bash
npm run desktop
```

That's it — the Electron app automatically starts the backend and opens the editor. No separate servers to babysit.

---

## 🎯 Why Developers Love It

| | |
|---|---|
| ✅ Visual instead of script-based | ✅ Zero frontend work for custom nodes |
| ✅ Live preview at every step | ✅ Deterministic Albumentations augmentation |
| ✅ Fast, targeted experimentation | ✅ Clean, dependency-free Python export |
| ✅ Metadata-driven architecture | ✅ Open source & self-hosted desktop app |
| ✅ Inline Custom Python when you need it | ✅ Versioned reusable scripts + trust gate |
| ✅ Script `log()` for in-graph debugging | ✅ Monaco editor with in-app helper docs |

---

## 🛣 Roadmap

- 🎥 Video pipelines & camera streaming
- 🧩 ONNX Runtime and PyTorch inference nodes
- ⚡ CUDA acceleration
- 📦 Batch processing
- 🔌 Plugin SDK (extend beyond built-in + user scripts)
- ☁️ Cloud workspaces
- 🤖 AI-assisted pipeline generation
- 🧰 More script helpers beyond `log()` (rename / delete / export scripts with workflows)

---

## 🤝 Contributing

Contributions are welcome — bug fixes, performance improvements, new processing nodes, or entirely new features. If you're planning a large change, please open an issue first so we can discuss the design together.

---

## 📄 License

Distributed under the MIT License. See the **LICENSE** file for details.

</div>
