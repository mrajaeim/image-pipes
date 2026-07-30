"""Tests for color / contrast research nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_color_research_nodes_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert {"to_lab", "invert", "clahe", "brightness_contrast"}.issubset(types)


def test_invert_is_involution() -> None:
    register_builtin_nodes()
    image = np.arange(16, dtype=np.uint8).reshape(4, 4)
    inverted = registry.get("invert").execute({"image": image}, {}, seed=0)["image"]
    restored = registry.get("invert").execute({"image": inverted}, {}, seed=0)["image"]
    assert np.array_equal(restored, image)


def test_clahe_on_gray_changes_histogram() -> None:
    register_builtin_nodes()
    image = np.linspace(40, 180, 64 * 64, dtype=np.float32).reshape(64, 64).astype(np.uint8)
    result = registry.get("clahe").execute(
        {"image": image},
        {"clip_limit": 2.0, "tile_grid": 8},
        seed=0,
    )["image"]
    assert result.shape == image.shape
    assert not np.array_equal(result, image)
