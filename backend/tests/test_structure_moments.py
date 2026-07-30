"""Tests for moments structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_moments_registered() -> None:
    register_builtin_nodes()
    assert "moments" in {meta.type for meta in registry.list_metadata()}


def test_moments_draws_centroid_for_blob() -> None:
    register_builtin_nodes()
    image = np.zeros((64, 64), dtype=np.uint8)
    image[20:44, 20:44] = 255
    result = registry.get("moments").execute(
        {"image": image},
        {"min_area": 20, "overlay": "blank"},
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
    # Centroid marker near image center should light up.
    assert int(result[30:34, 30:34].sum()) > 0
