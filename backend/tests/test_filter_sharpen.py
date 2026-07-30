"""Tests for sharpen filter node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_sharpen_registered() -> None:
    register_builtin_nodes()
    assert "sharpen" in {meta.type for meta in registry.list_metadata()}


def test_sharpen_laplacian_preserves_shape() -> None:
    register_builtin_nodes()
    image = np.zeros((24, 24, 3), dtype=np.uint8)
    image[8:16, 8:16] = (120, 120, 120)
    result = registry.get("sharpen").execute(
        {"image": image},
        {"amount": 1.0, "kernel": "laplacian"},
        seed=0,
    )["image"]
    assert result.shape == image.shape


def test_sharpen_unsharp_preserves_shape() -> None:
    register_builtin_nodes()
    image = np.zeros((24, 24, 3), dtype=np.uint8)
    image[8:16, 8:16] = (120, 120, 120)
    result = registry.get("sharpen").execute(
        {"image": image},
        {"amount": 1.0, "kernel": "unsharp"},
        seed=0,
    )["image"]
    assert result.shape == image.shape
