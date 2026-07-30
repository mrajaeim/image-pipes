"""Tests for convex hull structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_convex_hull_registered() -> None:
    register_builtin_nodes()
    assert "convex_hull" in {meta.type for meta in registry.list_metadata()}


def test_convex_hull_draws_for_l_shape() -> None:
    register_builtin_nodes()
    image = np.zeros((60, 60), dtype=np.uint8)
    image[10:50, 10:20] = 255
    image[40:50, 10:50] = 255
    result = registry.get("convex_hull").execute(
        {"image": image},
        {"thickness": 2, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
