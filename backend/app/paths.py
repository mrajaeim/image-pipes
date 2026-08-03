"""Shared filesystem locations for cache, uploads, outputs, and assets."""

from __future__ import annotations

import os
from pathlib import Path


def data_root() -> Path:
    """Return writable app data root (Electron sets IMAGE_PIPES_DATA_DIR)."""
    override = os.environ.get("IMAGE_PIPES_DATA_DIR")
    if override:
        root = Path(override)
    else:
        # backend/app/paths.py → backend/
        root = Path(__file__).resolve().parents[1]
    root.mkdir(parents=True, exist_ok=True)
    return root


def cache_dir() -> Path:
    path = data_root() / "cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def upload_dir() -> Path:
    path = data_root() / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def output_dir() -> Path:
    path = data_root() / "outputs"
    path.mkdir(parents=True, exist_ok=True)
    return path
