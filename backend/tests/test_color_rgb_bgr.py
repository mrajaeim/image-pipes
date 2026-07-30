"""Tests for To RGB / To BGR color conversion nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_to_rgb_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "to_rgb" in types


def test_to_rgb_swaps_channels() -> None:
    register_builtin_nodes()
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    image[:, :] = (10, 20, 30)  # B, G, R
    result = registry.get("to_rgb").execute({"image": image}, {}, seed=0)["image"]
    assert result.shape == image.shape
    assert tuple(result[0, 0]) == (30, 20, 10)


def test_to_rgb_from_gray() -> None:
    register_builtin_nodes()
    gray = np.full((8, 8), 42, dtype=np.uint8)
    result = registry.get("to_rgb").execute({"image": gray}, {}, seed=0)["image"]
    assert result.shape == (8, 8, 3)
    assert tuple(result[0, 0]) == (42, 42, 42)
