"""Tests for global threshold method variants."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes
from app.nodes.filters import _threshold_flag_expr


def test_threshold_exposes_method_options() -> None:
    register_builtin_nodes()
    meta = next(item for item in registry.list_metadata() if item.type == "threshold")
    method = next(field for field in meta.params if field.name == "method")
    assert method.options is not None
    assert "otsu" in method.options
    assert "triangle" in method.options
    assert "tozero" in method.options


def test_threshold_binary_default_compatible() -> None:
    register_builtin_nodes()
    image = np.array([[0, 100, 200], [50, 150, 255]], dtype=np.uint8)
    result = registry.get("threshold").execute(
        {"image": image},
        {"method": "binary", "thresh": 127.0, "maxval": 255.0},
        seed=0,
    )["image"]
    assert np.array_equal(result, np.array([[0, 0, 255], [0, 255, 255]], dtype=np.uint8))


def test_threshold_otsu_is_binary() -> None:
    register_builtin_nodes()
    rng = np.random.default_rng(0)
    image = np.concatenate(
        [
            rng.integers(20, 60, (32, 32), dtype=np.uint8),
            rng.integers(180, 220, (32, 32), dtype=np.uint8),
        ],
        axis=1,
    )
    result = registry.get("threshold").execute(
        {"image": image},
        {"method": "otsu", "thresh": 0.0, "maxval": 255.0},
        seed=0,
    )["image"]
    assert set(np.unique(result)).issubset({0, 255})


def test_threshold_trunc_caps_values() -> None:
    register_builtin_nodes()
    image = np.array([[0, 100, 200]], dtype=np.uint8)
    result = registry.get("threshold").execute(
        {"image": image},
        {"method": "trunc", "thresh": 150.0, "maxval": 255.0},
        seed=0,
    )["image"]
    assert np.array_equal(result, np.array([[0, 100, 150]], dtype=np.uint8))


def test_threshold_codegen_emits_selected_flag() -> None:
    expr = _threshold_flag_expr("otsu_inv")
    assert "THRESH_OTSU" in expr
    assert "THRESH_BINARY_INV" in expr
