"""Desktop / production server entrypoint for Image Pipes."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _prepare_environment() -> None:
    """Ensure import paths and data dirs work for source and frozen builds."""
    if getattr(sys, "frozen", False):
        # PyInstaller one-folder / one-file layout
        bundle_dir = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        backend_root = Path(sys.executable).resolve().parent
        if str(bundle_dir) not in sys.path:
            sys.path.insert(0, str(bundle_dir))
        frontend_dist = bundle_dir / "frontend" / "dist"
        if not frontend_dist.exists():
            frontend_dist = backend_root / "frontend" / "dist"
        os.environ.setdefault("IMAGE_PIPES_FRONTEND_DIST", str(frontend_dist))
        # Prefer examples next to the executable for template Load Image paths.
        examples = backend_root / "examples"
        if examples.exists():
            os.chdir(backend_root)
    else:
        backend_root = Path(__file__).resolve().parent
        if str(backend_root) not in sys.path:
            sys.path.insert(0, str(backend_root))
        repo_frontend = backend_root.parent / "frontend" / "dist"
        if repo_frontend.exists():
            os.environ.setdefault("IMAGE_PIPES_FRONTEND_DIST", str(repo_frontend))
        os.chdir(backend_root)


def main() -> None:
    _prepare_environment()

    host = os.environ.get("IMAGE_PIPES_HOST", "127.0.0.1")
    port = int(os.environ.get("IMAGE_PIPES_PORT", "8765"))

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("IMAGE_PIPES_LOG_LEVEL", "info"),
        factory=False,
    )


if __name__ == "__main__":
    main()
