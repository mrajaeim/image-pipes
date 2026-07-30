"""Tests for draw-histogram analysis node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_draw_histogram_registered() -> None:
    register_builtin_nodes()
    assert "draw_histogram" in {meta.type for meta in registry.list_metadata()}


def test_draw_histogram_renders_plot() -> None:
    register_builtin_nodes()
    image = np.zeros((32, 32, 3), dtype=np.uint8)
    image[:, :, 0] = 40
    image[:, :, 1] = 120
    image[:, :, 2] = 200
    result = registry.get("draw_histogram").execute(
        {"image": image},
        {"mode": "channels", "height": 128, "width": 256},
        seed=0,
    )["image"]
    assert result.shape == (128, 256, 3)
    assert int(result.sum()) > 0
