"""Tests for normalize and compare-hist analysis nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_normalize_and_compare_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "normalize" in types
    assert "compare_hist" in types


def test_normalize_minmax_range() -> None:
    register_builtin_nodes()
    image = np.full((16, 16), 40, dtype=np.uint8)
    image[4:12, 4:12] = 80
    result = registry.get("normalize").execute(
        {"image": image},
        {"alpha": 0.0, "beta": 255.0, "norm_type": "minmax"},
        seed=0,
    )["image"]
    assert result.dtype == np.uint8
    assert int(result.min()) == 0
    assert int(result.max()) == 255


def test_compare_hist_identical_images() -> None:
    register_builtin_nodes()
    image = np.zeros((24, 24), dtype=np.uint8)
    image[6:18, 6:18] = 180
    result = registry.get("compare_hist").execute(
        {"image_a": image, "image_b": image.copy()},
        {"method": "correlation"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
