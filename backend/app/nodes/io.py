"""Image I/O nodes: load, save, and preview."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.engine.run_context import (
    current_sample_index,
    current_source_stems,
    source_stem_for_sample,
)
from app.nodes.common import (
    IMAGE_EXTENSIONS,
    file_param,
    image_in,
    image_out,
    int_param,
    require_image,
    select_param,
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
    label = "Load Images"
    category = "io"
    description = "Load one or more images from files or a folder (output is an image array)."
    ports = [image_out(multiple=True)]
    params = [
        file_param(
            "path",
            "Images / Folder",
            "",
            accept=IMAGE_EXTENSIONS,
            description="Select multiple images or a folder of images",
        )
    ]

    def prepare_run(self, params: dict[str, Any]) -> None:
        path_value = str(params.get("path", ""))
        if not path_value:
            current_source_stems.set([])
            return
        try:
            files = list_image_files(Path(path_value))
            current_source_stems.set([file_path.stem for file_path in files])
        except (OSError, ValueError, FileNotFoundError):
            current_source_stems.set([])

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        path_value = str(params["path"])
        if not path_value:
            raise ValueError("Load Images requires a file or folder selection")
        path = Path(path_value)
        files = list_image_files(path)
        current_source_stems.set([file_path.stem for file_path in files])
        images = [read_image(file_path) for file_path in files]
        return {"image": images}

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
            "else:",
            "    _files = [_path]",
            "if not _files:",
            f"    raise FileNotFoundError({path!r})",
            f"{dst} = []",
            "for _file in _files:",
            "    _img = cv2.imread(str(_file), cv2.IMREAD_UNCHANGED)",
            "    if _img is None:",
            "        raise FileNotFoundError(str(_file))",
            f"    {dst}.append(_img)",
        ]


class SaveImageNode(BaseNode):
    type = "save_image"
    label = "Save Image"
    category = "io"
    description = (
        "Write image(s) into a selected output folder. "
        "Filename supports templates: {filename}, {time}, {index}."
    )
    cacheable = False
    ports = [image_in(), image_out()]
    params = [
        string_param(
            "directory",
            "Output folder",
            "",
            description="Required. Choose a root folder to save into.",
        ),
        string_param(
            "filename",
            "Filename",
            "{filename}_{index}.png",
            description="Templates: {filename}, {time}, {index}",
        ),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        directory = str(params.get("directory", "")).strip()
        if not directory:
            raise ValueError("Save Image requires an output folder — choose one in the inspector")
        image = require_image(inputs)
        sample_index = current_sample_index.get()
        path = resolve_save_path(
            directory,
            str(params.get("filename") or "{filename}_{index}.png"),
            index=sample_index,
            filename=source_stem_for_sample(sample_index),
            when=datetime.now(),
        )
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
        directory = str(params.get("directory", "")).strip()
        name_template = str(params.get("filename") or "{filename}_{index}.png")
        src = input_vars["image"]
        dst = output_vars["image"]
        return [
            "from datetime import datetime",
            f"_dir = Path({directory!r})",
            f"_name_template = {name_template!r}",
            "_index = 0  # set per sample when batching",
            "_filename = 'image'",
            "_time = datetime.now().strftime('%Y%m%d_%H%M%S')",
            (
                "_name = (_name_template.replace('{filename}', _filename)"
                ".replace('{time}', _time).replace('{index}', str(_index)))"
            ),
            "_name = Path(_name).name",
            (
                "if _index > 0 and '{index}' not in _name_template "
                "and '{time}' not in _name_template and '{filename}' not in _name_template:"
            ),
            "    _stem = Path(_name).stem",
            "    _suffix = Path(_name).suffix",
            "    _name = f'{_stem}_{_index}{_suffix}'",
            "_path = _dir / _name",
            "_path.parent.mkdir(parents=True, exist_ok=True)",
            f"cv2.imwrite(str(_path), {src})",
            f"{dst} = {src}",
        ]


def resolve_save_path(
    directory: str,
    name_template: str,
    *,
    index: int,
    filename: str,
    when: datetime,
) -> Path:
    """Join a root folder with an expanded filename template."""
    root = str(directory).strip()
    if not root:
        raise ValueError("Output folder is required")
    safe_name = Path(filename).stem or "image"
    safe_name = safe_name.replace("/", "_").replace("\\", "_")
    time_token = when.strftime("%Y%m%d_%H%M%S")
    expanded = (
        name_template.replace("{filename}", safe_name)
        .replace("{time}", time_token)
        .replace("{index}", str(index))
    )
    # Filename only — ignore any directory components in the template.
    name = Path(expanded).name or f"image_{index}.png"
    has_unique_token = any(
        token in name_template for token in ("{index}", "{time}", "{filename}")
    )
    if index > 0 and not has_unique_token:
        path_name = Path(name)
        name = f"{path_name.stem}_{index}{path_name.suffix}"
    return Path(root) / name


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


class BlankImageNode(BaseNode):
    type = "blank_image"
    label = "Blank Image"
    category = "io"
    description = (
        "Create a blank image with custom size. "
        "Optionally match size from a connected reference image."
    )
    ports = [
        image_in("size_ref", "Size Ref", optional=True),
        image_out(),
    ]
    params = [
        int_param("width", "Width", 256, minimum=1, maximum=8192),
        int_param("height", "Height", 256, minimum=1, maximum=8192),
        select_param("channels", "Channels", "bgr", ["gray", "bgr", "bgra"]),
        int_param("fill", "Fill", 0, minimum=0, maximum=255),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        width = max(1, int(params["width"]))
        height = max(1, int(params["height"]))
        fill = int(params["fill"])
        channels = str(params["channels"])

        size_ref = inputs.get("size_ref")
        if size_ref is not None:
            if isinstance(size_ref, list):
                if not size_ref:
                    raise ValueError("Empty image list for optional size_ref input")
                ref = size_ref[0]
            else:
                ref = size_ref
            height, width = int(ref.shape[0]), int(ref.shape[1])

        if channels == "gray":
            image = np.full((height, width), fill, dtype=np.uint8)
        elif channels == "bgra":
            image = np.full((height, width, 4), fill, dtype=np.uint8)
        else:
            image = np.full((height, width, 3), fill, dtype=np.uint8)
        return {"image": image}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        dst = output_vars["image"]
        width = max(1, int(params["width"]))
        height = max(1, int(params["height"]))
        fill = int(params["fill"])
        channels = str(params["channels"])
        lines: list[str] = [
            f"_w, _h, _fill = {width}, {height}, {fill}",
        ]
        if "size_ref" in input_vars:
            ref = input_vars["size_ref"]
            lines.extend(
                [
                    f"_ref = {ref}[0] if isinstance({ref}, list) else {ref}",
                    "_h, _w = int(_ref.shape[0]), int(_ref.shape[1])",
                ]
            )
        if channels == "gray":
            lines.append(f"{dst} = np.full((_h, _w), _fill, dtype='uint8')")
        elif channels == "bgra":
            lines.append(f"{dst} = np.full((_h, _w, 4), _fill, dtype='uint8')")
        else:
            lines.append(f"{dst} = np.full((_h, _w, 3), _fill, dtype='uint8')")
        return lines
