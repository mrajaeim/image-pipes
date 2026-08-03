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
from app.engine.save_bundle import get_folder_saves, get_save_bundle
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
        ),
        string_param(
            "asset_batch_id",
            "Asset Batch",
            "",
            description="Registered asset batch id (preferred over path)",
        ),
    ]

    def prepare_run(self, params: dict[str, Any]) -> None:
        try:
            files = resolve_load_paths(params)
            current_source_stems.set([file_path.stem for file_path in files])
        except (OSError, ValueError, FileNotFoundError):
            current_source_stems.set([])

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        files = resolve_load_paths(params)
        if not files:
            raise ValueError("Load Images requires a file or folder selection")
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
        path = str(params.get("path") or "")
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


def resolve_load_paths(params: dict[str, Any]) -> list[Path]:
    """Prefer asset_batch_id; fall back to legacy path param."""
    batch_id = str(params.get("asset_batch_id") or "").strip()
    if batch_id:
        from app.services.assets import list_batch_paths

        return list_batch_paths(batch_id)
    path_value = str(params.get("path") or "").strip()
    if not path_value:
        return []
    return list_image_files(Path(path_value))


class SaveImageNode(BaseNode):
    type = "save_image"
    label = "Save Image"
    category = "io"
    description = (
        "Write image(s) to an output folder after the run "
        "(or pack into a ZIP when no folder is set). "
        "Filename supports templates: {filename}, {time}, {index}."
    )
    cacheable = False
    ports = [image_in(), image_out()]
    params = [
        string_param(
            "output_dir",
            "Output Folder",
            "",
            description="Local folder for saved images (desktop)",
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
        image = require_image(inputs)
        sample_index = current_sample_index.get()
        name = resolve_save_filename(
            str(params.get("filename") or "{filename}_{index}.png"),
            index=sample_index,
            filename=source_stem_for_sample(sample_index),
            when=datetime.now(),
        )
        output_dir = str(params.get("output_dir") or "").strip()
        if output_dir:
            written = write_image_to_dir(Path(output_dir), name, image)
            get_folder_saves().record(written)
        else:
            get_save_bundle().add_image(name, image)
        return {"image": image}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        name_template = str(params.get("filename") or "{filename}_{index}.png")
        output_dir = str(params.get("output_dir") or "output")
        src = input_vars["image"]
        dst = output_vars["image"]
        return [
            "from datetime import datetime",
            "from pathlib import Path",
            f"_out_dir = Path({output_dir!r})",
            "_out_dir.mkdir(parents=True, exist_ok=True)",
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
            "    _suffix = Path(_name).suffix or '.png'",
            "    _name = f'{_stem}_{_index}{_suffix}'",
            "cv2.imwrite(str(_out_dir / _name), " + src + ")",
            f"{dst} = {src}",
        ]


def write_image_to_dir(directory: Path, name: str, image: np.ndarray) -> Path:
    """Encode and write an image under directory, avoiding name collisions."""
    directory.mkdir(parents=True, exist_ok=True)
    safe = Path(name).name or "image.png"
    suffix = Path(safe).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
        safe = f"{Path(safe).stem}.png"
        suffix = ".png"
    target = directory / safe
    stem = target.stem
    file_suffix = target.suffix
    index = 2
    while target.exists():
        target = directory / f"{stem}_{index}{file_suffix}"
        index += 1
    encode_ext = ".jpg" if suffix in {".jpg", ".jpeg"} else suffix
    success, buffer = cv2.imencode(encode_ext, image)
    if not success:
        success, buffer = cv2.imencode(".png", image)
        target = target.with_suffix(".png")
    if not success:
        raise RuntimeError(f"Failed to encode image for '{target.name}'")
    target.write_bytes(buffer.tobytes())
    return target.resolve()


def resolve_save_filename(
    name_template: str,
    *,
    index: int,
    filename: str,
    when: datetime,
) -> str:
    """Expand {filename}, {time}, {index} into a ZIP entry filename."""
    safe_name = Path(filename).stem or "image"
    safe_name = safe_name.replace("/", "_").replace("\\", "_")
    time_token = when.strftime("%Y%m%d_%H%M%S")
    expanded = (
        name_template.replace("{filename}", safe_name)
        .replace("{time}", time_token)
        .replace("{index}", str(index))
    )
    name = Path(expanded).name or f"image_{index}.png"
    if not Path(name).suffix:
        name = f"{name}.png"
    has_unique_token = any(
        token in name_template for token in ("{index}", "{time}", "{filename}")
    )
    if index > 0 and not has_unique_token:
        path_name = Path(name)
        name = f"{path_name.stem}_{index}{path_name.suffix}"
    return name


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
