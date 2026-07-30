"""Tests for edge / enhancement filter nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_edge_filter_nodes_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert {"bilateral_filter", "sobel", "laplacian"}.issubset(types)


def test_sobel_produces_gradient_response() -> None:
    register_builtin_nodes()
    image = np.zeros((24, 24), dtype=np.uint8)
    image[:, 12:] = 255
    result = registry.get("sobel").execute(
        {"image": image},
        {"dx": "1", "dy": "0", "ksize": 3, "scale": 1.0},
        seed=0,
    )["image"]
    assert isinstance(result, np.ndarray)
    assert result.shape == image.shape
    assert int(result.max()) > 0


def test_bilateral_preserves_shape() -> None:
    register_builtin_nodes()
    image = np.random.default_rng(0).integers(0, 255, (20, 20, 3), dtype=np.uint8)
    result = registry.get("bilateral_filter").execute(
        {"image": image},
        {"d": 5, "sigma_color": 50.0, "sigma_space": 50.0},
        seed=0,
    )["image"]
    assert result.shape == image.shape
