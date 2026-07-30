"""Tests for Apply Mask node."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_apply_mask_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert "apply_mask" in types


def test_apply_mask_zeros_outside() -> None:
    register_builtin_nodes()
    image = np.full((8, 8, 3), 200, dtype=np.uint8)
    mask = np.zeros((8, 8), dtype=np.uint8)
    mask[2:6, 2:6] = 255
    result = registry.get("apply_mask").execute(
        {"image": image, "mask": mask},
        {"fill": "black"},
        seed=0,
    )["image"]
    assert result.shape == image.shape
    assert tuple(result[0, 0]) == (0, 0, 0)
    assert tuple(result[4, 4]) == (200, 200, 200)


def test_apply_mask_white_fill() -> None:
    register_builtin_nodes()
    image = np.full((4, 4, 3), 10, dtype=np.uint8)
    mask = np.zeros((4, 4), dtype=np.uint8)
    mask[:, :2] = 255
    result = registry.get("apply_mask").execute(
        {"image": image, "mask": mask},
        {"fill": "white"},
        seed=0,
    )["image"]
    assert tuple(result[0, 0]) == (10, 10, 10)
    assert tuple(result[0, 3]) == (255, 255, 255)
