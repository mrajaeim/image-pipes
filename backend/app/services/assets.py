"""In-memory + disk-backed registry of image asset batches."""

from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path

from app.models.assets import AssetBatch, AssetFile, AssetKind
from app.nodes.common import IMAGE_EXTENSIONS
from app.paths import data_root

_lock = threading.RLock()
_batches: dict[str, AssetBatch] = {}
_loaded = False


def _registry_path() -> Path:
    path = data_root() / "assets"
    path.mkdir(parents=True, exist_ok=True)
    return path / "registry.json"


def _allowed_extension(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in {ext.lower() for ext in IMAGE_EXTENSIONS}


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        path = _registry_path()
        if path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                for item in raw.get("batches", []):
                    batch = AssetBatch.model_validate(item)
                    _batches[batch.id] = batch
            except (OSError, json.JSONDecodeError, ValueError):
                _batches.clear()
        _loaded = True


def _persist() -> None:
    path = _registry_path()
    payload = {
        "batches": [batch.model_dump() for batch in _batches.values()],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def clear_registry() -> None:
    """Test helper: drop all batches and reload flag."""
    global _loaded
    with _lock:
        _batches.clear()
        _loaded = True
        path = _registry_path()
        if path.is_file():
            path.unlink()


def get_batch(batch_id: str) -> AssetBatch | None:
    _ensure_loaded()
    with _lock:
        return _batches.get(batch_id)


def list_batch_paths(batch_id: str) -> list[Path]:
    """Resolve a batch to concrete image paths for Load Image."""
    batch = get_batch(batch_id)
    if batch is None:
        raise FileNotFoundError(f"Unknown asset batch '{batch_id}'")
    if not batch.files:
        if batch.root:
            root = Path(batch.root)
            if root.is_dir():
                from app.nodes.io import list_image_files

                return list_image_files(root)
            if root.is_file():
                return [root]
        raise FileNotFoundError(f"Asset batch '{batch_id}' has no files")
    paths: list[Path] = []
    for item in batch.files:
        path = Path(item.path)
        if not path.is_file():
            raise FileNotFoundError(f"Missing asset file '{item.path}'")
        paths.append(path)
    return paths


def _unique_name(existing: set[str], filename: str) -> str:
    if filename not in existing:
        return filename
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    index = 2
    while True:
        candidate = f"{stem}_{index}{suffix}"
        if candidate not in existing:
            return candidate
        index += 1


def register_paths(
    paths: list[str],
    *,
    as_folder: bool = False,
    append_to: str | None = None,
    kind: AssetKind | None = None,
) -> AssetBatch:
    """Register absolute paths as an asset batch (no file copy)."""
    _ensure_loaded()
    resolved: list[Path] = []
    for raw in paths:
        path = Path(raw).expanduser().resolve()
        if path.is_dir():
            from app.nodes.io import list_image_files

            resolved.extend(list_image_files(path))
        elif path.is_file():
            if not _allowed_extension(path.name):
                continue
            resolved.append(path)
    if not resolved:
        raise ValueError("No supported image files to register")

    with _lock:
        if append_to:
            batch = _batches.get(append_to)
            if batch is None:
                raise FileNotFoundError(f"Unknown asset batch '{append_to}'")
            names = {item.name for item in batch.files}
            for path in resolved:
                name = _unique_name(names, path.name)
                names.add(name)
                batch.files.append(AssetFile(name=name, path=str(path)))
            if batch.root is None and batch.files:
                batch.root = str(Path(batch.files[0].path).parent)
            _batches[batch.id] = batch
            _persist()
            return batch

        batch_id = uuid.uuid4().hex
        files: list[AssetFile] = []
        names: set[str] = set()
        for path in resolved:
            name = _unique_name(names, path.name)
            names.add(name)
            files.append(AssetFile(name=name, path=str(path)))

        if as_folder or len(files) > 1:
            roots = {str(Path(item.path).parent) for item in files}
            root = next(iter(roots)) if len(roots) == 1 else None
            if as_folder and len(paths) == 1 and Path(paths[0]).is_dir():
                root = str(Path(paths[0]).expanduser().resolve())
            resolved_kind: AssetKind = kind or ("folder" if as_folder else "external")
        else:
            root = str(Path(files[0].path).parent)
            resolved_kind = kind or "external"

        batch = AssetBatch(id=batch_id, kind=resolved_kind, files=files, root=root)
        _batches[batch_id] = batch
        _persist()
        return batch


def register_staged_files(
    file_paths: list[Path],
    *,
    root: Path | None = None,
    append_to: str | None = None,
) -> AssetBatch:
    """Register files that already live under uploads/ (HTTP upload path)."""
    return register_paths(
        [str(path) for path in file_paths],
        as_folder=len(file_paths) > 1 or root is not None,
        append_to=append_to,
        kind="staged",
    )


def remove_file(batch_id: str, name_or_path: str) -> AssetBatch | None:
    """Remove one file from a batch. Returns updated batch, or None if deleted."""
    _ensure_loaded()
    with _lock:
        batch = _batches.get(batch_id)
        if batch is None:
            raise FileNotFoundError(f"Unknown asset batch '{batch_id}'")
        remaining: list[AssetFile] = []
        removed: AssetFile | None = None
        for item in batch.files:
            if item.name == name_or_path or item.path == name_or_path:
                removed = item
                continue
            remaining.append(item)
        if removed is None:
            raise FileNotFoundError(f"File not found in batch '{batch_id}'")
        if not remaining:
            del _batches[batch_id]
            _persist()
            return None
        batch.files = remaining
        _batches[batch_id] = batch
        _persist()
        return batch


def preview_url(batch_id: str, name: str) -> str:
    from urllib.parse import quote

    return f"/api/assets/{batch_id}/files/{quote(name)}"
