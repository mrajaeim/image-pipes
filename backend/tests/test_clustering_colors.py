"""Tests for dominant-color clustering nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_clustering_nodes_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "kmeans_colors" in types
    assert "dominant_colors_hist" in types


def test_kmeans_colors_quantizes() -> None:
    register_builtin_nodes()
    image = np.zeros((40, 40, 3), dtype=np.uint8)
    image[:20, :, :] = (0, 0, 255)
    image[20:, :, :] = (0, 255, 0)
    result = registry.get("kmeans_colors").execute(
        {"image": image},
        {"k": 2, "attempts": 2, "output": "quantized", "palette_height": 24},
        seed=0,
    )["image"]
    assert result.shape == image.shape
    unique = {tuple(int(c) for c in px) for px in result.reshape(-1, 3)}
    assert len(unique) <= 2


def test_dominant_colors_hist_palette() -> None:
    register_builtin_nodes()
    image = np.zeros((32, 32, 3), dtype=np.uint8)
    image[:16, :, :] = (10, 20, 200)
    image[16:, :, :] = (200, 30, 40)
    result = registry.get("dominant_colors_hist").execute(
        {"image": image},
        {"bins": 8, "top_k": 2, "output": "palette", "palette_height": 24},
        seed=0,
    )["image"]
    assert result.shape == (24, 32, 3)
    assert int(result.sum()) > 0
