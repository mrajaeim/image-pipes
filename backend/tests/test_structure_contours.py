"""Tests for find-contours structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_find_contours_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "find_contours" in types


def test_find_contours_draws_on_blob() -> None:
    register_builtin_nodes()
    image = np.zeros((48, 48), dtype=np.uint8)
    image[12:36, 12:36] = 255
    result = registry.get("find_contours").execute(
        {"image": image},
        {"mode": "external", "method": "simple", "thickness": 2, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
