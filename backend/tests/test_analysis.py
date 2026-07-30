"""Tests for analysis research nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_analysis_nodes_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert {"adaptive_threshold", "distance_transform", "histogram_equalize"}.issubset(types)


def test_adaptive_threshold_is_binary() -> None:
    register_builtin_nodes()
    rng = np.random.default_rng(0)
    image = rng.integers(40, 200, (48, 48), dtype=np.uint8)
    result = registry.get("adaptive_threshold").execute(
        {"image": image},
        {
            "maxval": 255.0,
            "method": "gaussian",
            "type": "binary",
            "block_size": 11,
            "c": 2.0,
        },
        seed=0,
    )["image"]
    assert set(np.unique(result)).issubset({0, 255})


def test_distance_transform_peaks_inside_blob() -> None:
    register_builtin_nodes()
    image = np.zeros((40, 40), dtype=np.uint8)
    image[10:30, 10:30] = 255
    result = registry.get("distance_transform").execute(
        {"image": image},
        {"distance": "l2", "mask_size": "5"},
        seed=0,
    )["image"]
    assert result[20, 20] > result[10, 10]
