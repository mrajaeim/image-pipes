"""Production helpers for serving the built React app."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def resolve_frontend_dist(dist_dir: Path | None = None) -> Path | None:
    if dist_dir is not None:
        return dist_dir if dist_dir.exists() else None

    env = os.environ.get("IMAGE_PIPES_FRONTEND_DIST")
    if env:
        candidate = Path(env)
        return candidate if candidate.exists() else None

    if getattr(sys, "frozen", False):
        bundle_dir = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        for candidate in (
            bundle_dir / "frontend" / "dist",
            Path(sys.executable).resolve().parent / "frontend" / "dist",
        ):
            if candidate.exists():
                return candidate
        return None

    root = Path(__file__).resolve().parents[3]
    candidate = root / "frontend" / "dist"
    return candidate if candidate.exists() else None


def mount_frontend(app: FastAPI, dist_dir: Path | None = None) -> None:
    dist = resolve_frontend_dist(dist_dir)
    if dist is None:
        return

    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    index = dist / "index.html"

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        candidate = dist / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)
