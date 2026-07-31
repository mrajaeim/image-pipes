"""Tests for load-image file/folder selection behavior."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes
from app.nodes.io import list_image_files
from app.paths import examples_dir, resolve_load_path


def _write(path: Path, value: int) -> None:
    image = np.full((8, 8, 3), value, dtype=np.uint8)
    cv2.imwrite(str(path), image)


def test_list_image_files_filters_extensions(tmp_path: Path) -> None:
    _write(tmp_path / "a.png", 10)
    _write(tmp_path / "b.jpg", 20)
    (tmp_path / "notes.txt").write_text("skip", encoding="utf-8")
    files = list_image_files(tmp_path)
    assert [path.name for path in files] == ["a.png", "b.jpg"]


def test_load_image_returns_array_from_folder(tmp_path: Path) -> None:
    register_builtin_nodes()
    _write(tmp_path / "a.png", 10)
    _write(tmp_path / "b.png", 40)
    node = registry.get("load_image")
    loaded = node.execute({}, {"path": str(tmp_path)}, seed=0)["image"]
    assert isinstance(loaded, list)
    assert len(loaded) == 2
    assert int(loaded[0].mean()) != int(loaded[1].mean())


def test_load_image_single_file_still_returns_list(tmp_path: Path) -> None:
    register_builtin_nodes()
    path = tmp_path / "only.png"
    _write(path, 12)
    loaded = registry.get("load_image").execute({}, {"path": str(path)}, seed=0)["image"]
    assert isinstance(loaded, list)
    assert len(loaded) == 1


def test_resolve_load_path_finds_bundled_example(tmp_path: Path, monkeypatch) -> None:
    lena = examples_dir() / "lena.png"
    assert lena.is_file(), f"expected bundled example at {lena}"
    monkeypatch.chdir(tmp_path)
    resolved = resolve_load_path("examples/lena.png")
    assert resolved.resolve() == lena.resolve()


def test_load_image_accepts_relative_example_path(tmp_path: Path, monkeypatch) -> None:
    register_builtin_nodes()
    monkeypatch.chdir(tmp_path)
    loaded = registry.get("load_image").execute(
        {}, {"path": "examples/lena.png"}, seed=0
    )["image"]
    assert isinstance(loaded, list)
    assert len(loaded) == 1
    assert loaded[0].ndim >= 2


def test_load_image_metadata_exposes_file_accept() -> None:
    register_builtin_nodes()
    meta = next(item for item in registry.list_metadata() if item.type == "load_image")
    field = meta.params[0]
    assert field.type == "file"
    assert field.accept is not None
    assert ".png" in field.accept
    assert meta.ports[0].multiple is True
