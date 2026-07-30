"""Tests for bounding-rect structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_bounding_rect_registered() -> None:
    register_builtin_nodes()
    assert "bounding_rect" in {meta.type for meta in registry.list_metadata()}


def test_bounding_rect_axis_draws() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[16:48, 20:44] = 255
    result = registry.get("bounding_rect").execute(
        {"image": image},
        {"kind": "axis", "min_area": 10, "thickness": 2, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0


def test_bounding_rect_rotated_draws() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[16:48, 20:44] = 255
    result = registry.get("bounding_rect").execute(
        {"image": image},
        {"kind": "rotated", "min_area": 10, "thickness": 2, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
