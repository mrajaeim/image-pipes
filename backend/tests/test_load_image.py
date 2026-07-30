"""Tests for load-image file/folder selection behavior."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes
from app.nodes.io import list_image_files


def _write(path: Path, value: int) -> None:
    image = np.full((8, 8, 3), value, dtype=np.uint8)
    cv2.imwrite(str(path), image)


def test_list_image_files_filters_extensions(tmp_path: Path) -> None:
    _write(tmp_path / "a.png", 10)
    _write(tmp_path / "b.jpg", 20)
    (tmp_path / "notes.txt").write_text("skip", encoding="utf-8")
    files = list_image_files(tmp_path)
    assert [path.name for path in files] == ["a.png", "b.jpg"]


def test_load_image_from_folder_uses_seed(tmp_path: Path) -> None:
    register_builtin_nodes()
    _write(tmp_path / "a.png", 10)
    _write(tmp_path / "b.png", 40)
    node = registry.get("load_image")
    first = node.execute({}, {"path": str(tmp_path)}, seed=0)["image"]
    second = node.execute({}, {"path": str(tmp_path)}, seed=1)["image"]
    assert isinstance(first, np.ndarray)
    assert isinstance(second, np.ndarray)
    assert int(first.mean()) != int(second.mean())


def test_load_image_metadata_exposes_file_accept() -> None:
    register_builtin_nodes()
    meta = next(item for item in registry.list_metadata() if item.type == "load_image")
    field = meta.params[0]
    assert field.type == "file"
    assert field.accept is not None
    assert ".png" in field.accept
