"""Tests for approx-poly structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_approx_poly_registered() -> None:
    register_builtin_nodes()
    assert "approx_poly" in {meta.type for meta in registry.list_metadata()}


def test_approx_poly_draws_for_rectangle() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[12:52, 16:48] = 255
    result = registry.get("approx_poly").execute(
        {"image": image},
        {"epsilon": 0.02, "min_area": 10, "thickness": 2, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
