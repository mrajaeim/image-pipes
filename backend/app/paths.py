"""Shared filesystem locations for cache, uploads, and downloads."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def data_root() -> Path:
    """Return writable app data root (Electron sets IMAGE_PIPES_DATA_DIR)."""
    override = os.environ.get("IMAGE_PIPES_DATA_DIR")
    if override:
        root = Path(override)
    else:
        root = Path(__file__).resolve().parents[2]
    root.mkdir(parents=True, exist_ok=True)
    return root


def examples_dir() -> Path:
    """Directory containing bundled example assets (e.g. lena.png)."""
    override = os.environ.get("IMAGE_PIPES_EXAMPLES_DIR")
    if override:
        return Path(override)
    # Source / normal install: backend/examples (this file is backend/app/paths.py)
    candidate = Path(__file__).resolve().parents[1] / "examples"
    if candidate.exists():
        return candidate
    if getattr(sys, "frozen", False):
        beside = Path(sys.executable).resolve().parent / "examples"
        if beside.exists():
            return beside
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            bundled = Path(meipass) / "examples"
            if bundled.exists():
                return bundled
    return candidate


def resolve_load_path(path_value: str) -> Path:
    """Resolve a load_image path, including portable example-relative paths.

    Template workflows store paths like ``examples/lena.png``. Those only exist
    when the process cwd is the backend root; resolve against ``examples_dir()``
    so loads work regardless of how the server was started.
    """
    path = Path(path_value)
    if path.exists():
        return path
    if path.is_absolute():
        return path
    # ``examples/lena.png`` → ``<backend>/examples/lena.png``
    relative_to_backend = examples_dir().parent / path
    if relative_to_backend.exists():
        return relative_to_backend
    # Bare filename → look under examples/
    under_examples = examples_dir() / path
    if under_examples.exists():
        return under_examples
    return path


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


def download_dir() -> Path:
    path = output_dir() / "downloads"
    path.mkdir(parents=True, exist_ok=True)
    return path
