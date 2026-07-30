"""Tests for box-blur filter node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_box_blur_registered() -> None:
    register_builtin_nodes()
    assert "box_blur" in {meta.type for meta in registry.list_metadata()}


def test_box_blur_smooths_noise() -> None:
    register_builtin_nodes()
    image = np.zeros((32, 32), dtype=np.uint8)
    image[::2, ::2] = 255
    result = registry.get("box_blur").execute(
        {"image": image},
        {"ksize": 5, "normalize": "true"},
        seed=0,
    )["image"]
    assert result.shape == image.shape
    # Averaging should reduce extreme checkerboard contrast.
    assert int(result.max()) < 255
