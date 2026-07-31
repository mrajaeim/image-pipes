# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Image Pipes desktop backend sidecar."""

from __future__ import annotations

import sys
from pathlib import Path

from PyInstaller.building.api import COLLECT, EXE, PYZ
from PyInstaller.building.build_main import Analysis
from PyInstaller.utils.hooks import collect_all, collect_submodules

SPEC_ROOT = Path(SPECPATH).resolve()
BACKEND_ROOT = SPEC_ROOT
REPO_ROOT = BACKEND_ROOT.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
EXAMPLES_DIR = BACKEND_ROOT / "examples"

datas: list = []
binaries: list = []
hiddenimports: list = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "app.main",
    "app.nodes",
    "multipart",
    "email.mime.multipart",
]

for package in ("albumentations", "cv2", "scipy", "sklearn", "pydantic", "anyio", "starlette"):
    try:
        collected = collect_all(package)
    except Exception:
        continue
    datas += collected[0]
    binaries += collected[1]
    hiddenimports += collected[2]

hiddenimports += collect_submodules("app")

if FRONTEND_DIST.exists():
    datas.append((str(FRONTEND_DIST), "frontend/dist"))
if EXAMPLES_DIR.exists():
    datas.append((str(EXAMPLES_DIR), "examples"))

a = Analysis(
    [str(BACKEND_ROOT / "run_server.py")],
    pathex=[str(BACKEND_ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="image-pipes-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="image-pipes-server",
)
