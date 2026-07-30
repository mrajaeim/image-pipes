"""Tests for blur-detect analysis node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_blur_detect_registered() -> None:
    register_builtin_nodes()
    assert "blur_detect" in {meta.type for meta in registry.list_metadata()}


def test_blur_detect_sharp_score_card() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[:, ::4] = 255
    result = registry.get("blur_detect").execute(
        {"image": image},
        {"ksize": 3, "threshold": 50.0, "output": "score_card"},
        seed=0,
    )["image"]
    assert result.shape == (120, 420, 3)
    assert int(result.sum()) > 0


def test_blur_detect_overlay_on_blurry() -> None:
    register_builtin_nodes()
    image = np.full((64, 64), 128, dtype=np.uint8)
    result = registry.get("blur_detect").execute(
        {"image": image},
        {"ksize": 3, "threshold": 100.0, "output": "overlay"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert result.shape[:2] == image.shape
