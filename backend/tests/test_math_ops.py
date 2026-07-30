"""Tests for bitwise / arithmetic math nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_math_ops_registered() -> None:
    register_builtin_nodes()
    types = {meta.type for meta in registry.list_metadata()}
    assert {"bitwise", "absdiff", "add_weighted", "arithmetic"} <= types


def test_bitwise_and() -> None:
    register_builtin_nodes()
    a = np.full((4, 4, 3), 200, dtype=np.uint8)
    b = np.full((4, 4, 3), 100, dtype=np.uint8)
    result = registry.get("bitwise").execute(
        {"a": a, "b": b, "mask": None},
        {"op": "and"},
        seed=0,
    )["image"]
    assert tuple(result[0, 0]) == (64, 64, 64)  # 200 & 100


def test_bitwise_with_mask() -> None:
    register_builtin_nodes()
    a = np.full((4, 4, 3), 255, dtype=np.uint8)
    b = np.full((4, 4, 3), 255, dtype=np.uint8)
    mask = np.zeros((4, 4), dtype=np.uint8)
    mask[:, :2] = 255
    result = registry.get("bitwise").execute(
        {"a": a, "b": b, "mask": mask},
        {"op": "and"},
        seed=0,
    )["image"]
    assert tuple(result[0, 0]) == (255, 255, 255)
    assert tuple(result[0, 3]) == (0, 0, 0)


def test_absdiff() -> None:
    register_builtin_nodes()
    a = np.full((3, 3, 3), 50, dtype=np.uint8)
    b = np.full((3, 3, 3), 20, dtype=np.uint8)
    result = registry.get("absdiff").execute({"a": a, "b": b}, {}, seed=0)["image"]
    assert tuple(result[0, 0]) == (30, 30, 30)


def test_add_weighted() -> None:
    register_builtin_nodes()
    a = np.full((2, 2, 3), 100, dtype=np.uint8)
    b = np.full((2, 2, 3), 0, dtype=np.uint8)
    result = registry.get("add_weighted").execute(
        {"a": a, "b": b},
        {"alpha": 0.5, "beta": 0.5, "gamma": 0},
        seed=0,
    )["image"]
    assert tuple(result[0, 0]) == (50, 50, 50)


def test_arithmetic_add() -> None:
    register_builtin_nodes()
    a = np.full((2, 2, 3), 200, dtype=np.uint8)
    b = np.full((2, 2, 3), 100, dtype=np.uint8)
    result = registry.get("arithmetic").execute(
        {"a": a, "b": b, "mask": None},
        {"op": "add"},
        seed=0,
    )["image"]
    assert tuple(result[0, 0]) == (255, 255, 255)  # saturated
