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
    # Filled bars should cover more than the dark background alone.
    assert int(result.sum()) > 24 * 128 * 256
    assert len(np.unique(result)) >= 5


def test_draw_histogram_gray_mode() -> None:
    register_builtin_nodes()
    gray = np.full((16, 16), 90, dtype=np.uint8)
    result = registry.get("draw_histogram").execute(
        {"image": gray},
        {"mode": "gray", "height": 64, "width": 128},
        seed=0,
    )["image"]
    assert result.shape == (64, 128, 3)
    assert int(result.max()) >= 200
