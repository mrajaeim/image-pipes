"""Image I/O nodes: load, save, and preview."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, require_image, string_param


class LoadImageNode(BaseNode):
    type = "load_image"
    label = "Load Image"
    category = "io"
    description = "Load an image from disk."
    ports = [image_out()]
    params = [string_param("path", "Path", "", description="Filesystem path to an image")]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        path = str(params["path"])
        if not path:
            raise ValueError("Load Image requires a non-empty path")
        image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        if image is None:
            raise FileNotFoundError(f"Could not read image at '{path}'")
        return {"image": image}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['image']} = cv2.imread({params['path']!r}, cv2.IMREAD_UNCHANGED)",
            f"if {output_vars['image']} is None:",
            f"    raise FileNotFoundError({params['path']!r})",
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
