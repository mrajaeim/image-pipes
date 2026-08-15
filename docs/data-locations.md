# Where Image Pipes stores files

This document describes **what is written to disk**, **where**, and **who writes it**. Paths are rooted at a single writable **data root** unless noted otherwise.

## Data root

All backend runtime data lives under `data_root()` (`backend/app/paths.py`):

| How you run | Data root |
|-------------|-----------|
| **Electron desktop** | `{app.getPath('userData')}/data` via env `IMAGE_PIPES_DATA_DIR` (set in `desktop/src/main.cjs`) |
| **Backend alone** (no env override) | `backend/` in the repo |

Electron never writes pipeline data into the app install directory.

On Windows this often looks like:

| Role | Example path |
|------|----------------|
| **Install** (app binary / resources) | `C:\Users\<you>\AppData\Local\Programs\Image Pipes\` |
| **Data root** (`IMAGE_PIPES_DATA_DIR`) | `C:\Users\<you>\AppData\Roaming\image-pipes-desktop\data\` |

`userData` is named after the Electron package `name` (`image-pipes-desktop` in `desktop/package.json`), not the display `productName` (“Image Pipes”). The install folder uses the product name.

### Typical Electron locations

| OS | Approx. data root |
|----|-------------------|
| Windows | `%APPDATA%\image-pipes-desktop\data\` |
| macOS | `~/Library/Application Support/image-pipes-desktop/data/` |
| Linux | `~/.config/image-pipes-desktop/data/` |

Layout under the data root:

```text
{data_root}/
  cache/           # DAG execution cache
  uploads/         # Browser-staged image copies
  outputs/         # Default Save Image destination (+ ZIPs)
  assets/          # Asset batch registry (paths, not always bytes)
  user_scripts/    # Reusable versioned Python scripts
```

---

## Images

### Load Image — desktop (preferred)

Native open-file / open-folder dialogs register **existing paths** through `POST /api/assets/register`.

- **Bytes:** stay where the user picked them (no copy into `uploads/`).
- **Metadata:** batch id + file list stored in `{data_root}/assets/registry.json`.
- Graph nodes keep `asset_batch_id` in workflow JSON (not the image bytes).

### Load Image — browser / upload API

`POST /api/uploads` copies files into:

```text
{data_root}/uploads/{batch_or_file}/…
```

Those paths are then registered as an asset batch (same registry as above).

### Sample images

`POST /api/assets/sample` registers packaged sample image paths (again via the asset registry; no permanent copy into `uploads/` unless the upload path is used).

### Save Image node

| Packaging | Destination |
|-----------|-------------|
| **bare** | Files written under `output_dir` param if set; otherwise `{data_root}/outputs/` |
| **zip** | Images collected then written as `results_*.zip` under that same destination (or downloads via `/api/downloads/{filename}` when serving a ZIP) |

Filename templates: `{filename}`, `{time}`, `{index}`.

On desktop, the UI can set `output_dir` to a user-picked folder (`pickFolder`); bare files then land there instead of under `outputs/`.

### Execution cache (intermediate images)

DAG node outputs are content-addressed under:

```text
{data_root}/cache/
```

Used for skip-on-unchanged runs; safe to delete (next run recomputes).

---

## User scripts (reusable nodes)

Saved from **Custom Python → Save as reusable node**, or edited from a **My Scripts** node.

```text
{data_root}/user_scripts/
  script_001/
    meta.json          # id, display name, current_version, timestamps
    v1/process.py
    v2/process.py      # edits always add a new version; never overwrite
  script_002/
    …
```

- **Ids** are auto-allocated (`script_001`, …); the user only chooses a display name.
- Canvas nodes store type `user_script.script_NNN` and a pinned **`version`** param — code is **not** embedded in the workflow JSON; execute reads `process.py` from disk.
- API: `/api/user-scripts` (list/create), `/api/user-scripts/{id}/versions` (new version / get code).

Inline **Custom Python** nodes keep code in the graph (`params.code`) and do not write under `user_scripts/` until saved as reusable.

---

## Workflows (graphs)

Stored in the **renderer** (Chromium) `localStorage`, not under `{data_root}`:

| Key | Purpose |
|-----|---------|
| `image-pipes.workflow.v1` | Autosaved current canvas session |
| Workflow library key (see `workflowLibrary.ts`) | Named multi-workflow library |

Export / import as JSON files is user-driven (download/open); those files live wherever the user saves them.

**Not persisted in workflow JSON:** custom-code trust fingerprints and the session cache of user-script source text used for trust UI.

---

## Quick reference

| Kind | Location | Copied? |
|------|----------|---------|
| Desktop-picked inputs | Original paths + `assets/registry.json` | No |
| Browser uploads | `uploads/` | Yes |
| Save Image (default) | `outputs/` or chosen folder | Written by app |
| Run cache | `cache/` | Yes (ephemeral) |
| Reusable scripts | `user_scripts/script_*/v*/process.py` | Yes |
| Workflows | Browser `localStorage` | N/A |
| App install / frontend `dist` | Packaged resources | Read-only |

Code entry points: `backend/app/paths.py`, `desktop/src/main.cjs` (`IMAGE_PIPES_DATA_DIR`), `backend/app/services/assets.py`, `backend/app/services/user_scripts.py`, `frontend/src/workflow/persist.ts`.
