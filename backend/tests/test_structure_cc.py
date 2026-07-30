"""Tests for connected-components structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_connected_components_registered() -> None:
    register_builtin_nodes()
    assert "connected_components" in {meta.type for meta in registry.list_metadata()}


def test_connected_components_boxes_two_blobs() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[8:24, 8:24] = 255
    image[40:56, 40:56] = 255
    result = registry.get("connected_components").execute(
        {"image": image},
        {"connectivity": "8", "min_area": 10, "mode": "boxes", "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0


def test_connected_components_labels_mode() -> None:
    register_builtin_nodes()
    image = np.zeros((48, 48), dtype=np.uint8)
    image[10:30, 10:30] = 255
    result = registry.get("connected_components").execute(
        {"image": image},
        {"connectivity": "8", "min_area": 10, "mode": "labels", "overlay": "blank"},
        seed=1,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
