"""Tests for additional color-space conversion nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_yuv_ycrcb_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "to_yuv" in types
    assert "to_ycrcb" in types


def test_to_yuv_shape() -> None:
    register_builtin_nodes()
    image = np.zeros((16, 16, 3), dtype=np.uint8)
    image[:, :] = (40, 80, 160)
    result = registry.get("to_yuv").execute({"image": image}, {}, seed=0)["image"]
    assert result.shape == image.shape


def test_to_ycrcb_shape() -> None:
    register_builtin_nodes()
    image = np.zeros((16, 16, 3), dtype=np.uint8)
    image[:, :] = (40, 80, 160)
    result = registry.get("to_ycrcb").execute({"image": image}, {}, seed=0)["image"]
    assert result.shape == image.shape
