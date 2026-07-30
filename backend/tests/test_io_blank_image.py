"""Tests for blank-image I/O node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_blank_image_registered() -> None:
    register_builtin_nodes()
    meta = next(m for m in registry.list_metadata() if m.type == "blank_image")
    size_ref = next(port for port in meta.ports if port.id == "size_ref")
    assert size_ref.optional is True
    assert size_ref.name == "Size Ref"


def test_blank_image_custom_size() -> None:
    register_builtin_nodes()
    result = registry.get("blank_image").execute(
        {},
        {"width": 120, "height": 80, "channels": "bgr", "fill": 0},
        seed=0,
    )["image"]
    assert result.shape == (80, 120, 3)
    assert int(result.sum()) == 0


def test_blank_image_uses_optional_size_ref() -> None:
    register_builtin_nodes()
    ref = np.zeros((45, 90), dtype=np.uint8)
    result = registry.get("blank_image").execute(
        {"size_ref": ref},
        {"width": 10, "height": 10, "channels": "gray", "fill": 128},
        seed=0,
    )["image"]
    assert result.shape == (45, 90)
    assert int(result[0, 0]) == 128


def test_blank_image_without_size_ref() -> None:
    register_builtin_nodes()
    result = registry.get("blank_image").execute(
        {"size_ref": None},
        {"width": 16, "height": 24, "channels": "bgra", "fill": 255},
        seed=0,
    )["image"]
    assert result.shape == (24, 16, 4)
    assert int(result[0, 0, 0]) == 255
