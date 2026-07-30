"""Image I/O nodes: load, save, and preview."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import (
    IMAGE_EXTENSIONS,
    file_param,
    image_in,
    image_out,
    require_image,
    string_param,
)


def _normalized_extensions(extensions: list[str] | None = None) -> set[str]:
    values = extensions or IMAGE_EXTENSIONS
    return {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in values}


def list_image_files(path: Path, extensions: list[str] | None = None) -> list[Path]:
    allowed = _normalized_extensions(extensions)
    if path.is_file():
        if path.suffix.lower() not in allowed:
            raise ValueError(f"Unsupported image extension '{path.suffix}' for '{path}'")
        return [path]
    if not path.is_dir():
        raise FileNotFoundError(f"Path not found: '{path}'")
    files = sorted(
        candidate
        for candidate in path.iterdir()
        if candidate.is_file() and candidate.suffix.lower() in allowed
    )
    if not files:
        raise FileNotFoundError(f"No supported image files found in '{path}'")
    return files


def read_image(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise FileNotFoundError(f"Could not read image at '{path}'")
    return image


class LoadImageNode(BaseNode):
    type = "load_image"
    label = "Load Image"
    category = "io"
    description = "Load an image file, or a folder of images (one per sample)."
    ports = [image_out()]
    params = [
        file_param(
            "path",
            "Image / Folder",
            "",
            accept=IMAGE_EXTENSIONS,
            description="Select an image file or a folder of images",
        )
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        path_value = str(params["path"])
        if not path_value:
            raise ValueError("Load Image requires a file or folder selection")
        path = Path(path_value)
        files = list_image_files(path)
        selected = files[seed % len(files)]
        return {"image": read_image(selected)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        path = params["path"]
        dst = output_vars["image"]
        return [
            f"_path = Path({path!r})",
            "_exts = {'.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp', '.gif'}",
            "if _path.is_dir():",
            "    _files = sorted(p for p in _path.iterdir() if p.suffix.lower() in _exts)",
            "    if not _files:",
            f"        raise FileNotFoundError({path!r})",
            "    _selected = _files[seed % len(_files)]",
            "else:",
            "    _selected = _path",
            f"{dst} = cv2.imread(str(_selected), cv2.IMREAD_UNCHANGED)",
            f"if {dst} is None:",
            "    raise FileNotFoundError(str(_selected))",
        ]


class SaveImageNode(BaseNode):
    type = "save_image"
    label = "Save Image"
    category = "io"
    description = "Write an image to disk."
    ports = [image_in(), image_out()]
    params = [string_param("path", "Path", "output.png")]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        path = Path(str(params["path"]))
        path.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(path), image):
            raise RuntimeError(f"Failed to write image to '{path}'")
        return {"image": image}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"cv2.imwrite({params['path']!r}, {input_vars['image']})",
            f"{output_vars['image']} = {input_vars['image']}",
        ]


class PreviewNode(BaseNode):
    type = "preview"
    label = "Preview"
    category = "io"
    description = "Pass-through node used for intermediate previews."
    ports = [image_in(), image_out()]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        return {"image": require_image(inputs)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = {input_vars['image']}  # preview"]
