"""Tests for blob-detect structure node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_blob_detect_registered() -> None:
    register_builtin_nodes()
    assert "blob_detect" in {meta.type for meta in registry.list_metadata()}


def test_blob_detect_finds_circular_blob() -> None:
    register_builtin_nodes()
    image = np.zeros((120, 120), dtype=np.uint8)
    # SimpleBlobDetector often prefers dark blobs on light background.
    image[:] = 255
    yy, xx = np.ogrid[:120, :120]
    mask = (xx - 60) ** 2 + (yy - 60) ** 2 <= 18**2
    image[mask] = 0
    result = registry.get("blob_detect").execute(
        {"image": image},
        {
            "min_area": 50.0,
            "max_area": 5000.0,
            "min_circularity": 0.5,
            "min_convexity": 0.5,
            "min_inertia": 0.2,
            "overlay": "blank",
        },
        seed=0,
    )["image"]
    assert result.ndim == 3
    assert int(result.sum()) > 0
