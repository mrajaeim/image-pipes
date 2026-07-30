"""Tests for morphological nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_morphology_nodes_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert {"erode", "dilate", "morphology_ex"}.issubset(types)


def test_erode_shrinks_bright_blob() -> None:
    register_builtin_nodes()
    image = np.zeros((32, 32), dtype=np.uint8)
    image[10:22, 10:22] = 255
    eroded = registry.get("erode").execute(
        {"image": image},
        {"ksize": 3, "iterations": 1, "shape": "rect"},
        seed=0,
    )["image"]
    assert isinstance(eroded, np.ndarray)
    assert int(eroded.sum()) < int(image.sum())


def test_morphology_open_removes_speckle() -> None:
    register_builtin_nodes()
    image = np.zeros((40, 40), dtype=np.uint8)
    image[15:25, 15:25] = 255
    image[2, 2] = 255
    opened = registry.get("morphology_ex").execute(
        {"image": image},
        {"op": "open", "ksize": 3, "shape": "rect"},
        seed=0,
    )["image"]
    assert opened[2, 2] == 0
    assert opened[20, 20] == 255
