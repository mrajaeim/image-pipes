"""Tests for Custom Python node."""

from __future__ import annotations

import numpy as np
import pytest

from app.engine.executor import DagExecutor, DagValidationError
from app.engine.registry import registry
from app.models.graph import (
    Edge,
    ExecuteRequest,
    Graph,
    NodeInstance,
)
from app.nodes import register_builtin_nodes
from app.nodes.custom import DEFAULT_CUSTOM_CODE


def test_custom_python_registered() -> None:
    register_builtin_nodes()
    assert "custom_python" in {meta.type for meta in registry.list_metadata()}


def test_custom_python_identity() -> None:
    register_builtin_nodes()
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    image[2:6, 2:6] = (10, 20, 30)
    result = registry.get("custom_python").execute(
        {"image": image},
        {"code": DEFAULT_CUSTOM_CODE},
        seed=0,
    )["image"]
    np.testing.assert_array_equal(result, image)


def test_custom_python_simple_transform() -> None:
    register_builtin_nodes()
    image = np.full((4, 4, 3), 10, dtype=np.uint8)
    code = """
def process(image, seed=0):
    return image + 5
"""
    result = registry.get("custom_python").execute(
        {"image": image},
        {"code": code},
        seed=0,
    )["image"]
    np.testing.assert_array_equal(result, image + 5)


def test_custom_python_bad_syntax() -> None:
    register_builtin_nodes()
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="syntax error"):
        registry.get("custom_python").execute(
            {"image": image},
            {"code": "def process(image, seed=0\n    return image"},
            seed=0,
        )


def test_custom_python_missing_process() -> None:
    register_builtin_nodes()
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="process"):
        registry.get("custom_python").execute(
            {"image": image},
            {"code": "x = 1"},
            seed=0,
        )


def test_custom_python_wrong_return_type() -> None:
    register_builtin_nodes()
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    with pytest.raises(TypeError, match="ndarray"):
        registry.get("custom_python").execute(
            {"image": image},
            {"code": "def process(image, seed=0):\n    return 42"},
            seed=0,
        )


def test_executor_rejects_custom_python_without_allow(tmp_path) -> None:
    register_builtin_nodes()
    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(id="src", type="blank_image", params={"width": 8, "height": 8}),
                NodeInstance(
                    id="custom",
                    type="custom_python",
                    params={"code": DEFAULT_CUSTOM_CODE},
                ),
            ],
            edges=[
                Edge(
                    id="e1",
                    source="src",
                    source_port="image",
                    target="custom",
                    target_port="image",
                ),
            ],
        ),
        allow_custom_code=False,
    )
    executor = DagExecutor(tmp_path / "cache")
    with pytest.raises(DagValidationError, match="Trust the custom code"):
        executor.execute(request)


def test_executor_runs_custom_python_when_allowed(tmp_path) -> None:
    register_builtin_nodes()
    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(id="src", type="blank_image", params={"width": 8, "height": 8}),
                NodeInstance(
                    id="custom",
                    type="custom_python",
                    params={"code": DEFAULT_CUSTOM_CODE},
                ),
            ],
            edges=[
                Edge(
                    id="e1",
                    source="src",
                    source_port="image",
                    target="custom",
                    target_port="image",
                ),
            ],
        ),
        allow_custom_code=True,
    )
    executor = DagExecutor(tmp_path / "cache")
    result = executor.execute(request)
    assert "order" in result
