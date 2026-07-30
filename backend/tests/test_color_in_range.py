"""Tests for in-range color filter node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_in_range_registered() -> None:
    register_builtin_nodes()
    assert "in_range" in {meta.type for meta in registry.list_metadata()}


def test_in_range_hsv_mask() -> None:
    register_builtin_nodes()
    image = np.zeros((40, 40, 3), dtype=np.uint8)
    # Pure green in BGR
    image[10:30, 10:30] = (0, 255, 0)
    result = registry.get("in_range").execute(
        {"image": image},
        {
            "space": "hsv",
            "c0_min": 35,
            "c0_max": 85,
            "c1_min": 50,
            "c1_max": 255,
            "c2_min": 50,
            "c2_max": 255,
            "output": "mask",
        },
        seed=0,
    )["image"]
    assert result.ndim == 2
    assert int(result[20, 20]) == 255
    assert int(result[0, 0]) == 0
