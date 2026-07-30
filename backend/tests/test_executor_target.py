"""Tests for run-to-target partial DAG execution."""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest

from app.engine.executor import (
    DagExecutor,
    DagValidationError,
    ancestors_through_target,
)
from app.engine.registry import BaseNode, NodeRegistry
from app.models.graph import (
    Edge,
    ExecuteRequest,
    Graph,
    NodeInstance,
    ParamField,
    PortDirection,
    PortSpec,
)


class _SourceNode(BaseNode):
    type = "source"
    label = "Source"
    category = "test"
    ports = [PortSpec(id="image", name="Image", direction=PortDirection.OUTPUT)]
    params = [ParamField(name="value", label="Value", type="number", default=1)]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        return {"image": np.full((4, 4), int(params["value"]), dtype=np.uint8)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = np.zeros((4, 4), dtype='uint8')"]


class _AddNode(BaseNode):
    type = "add"
    label = "Add"
    category = "test"
    ports = [
        PortSpec(id="image", name="Image", direction=PortDirection.INPUT),
        PortSpec(id="image", name="Image", direction=PortDirection.OUTPUT),
    ]
    params = [ParamField(name="delta", label="Delta", type="number", default=1)]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = inputs["image"]
        assert isinstance(image, np.ndarray)
        return {"image": image + int(params["delta"])}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = {input_vars['image']} + {params['delta']}"]


def _registry() -> NodeRegistry:
    reg = NodeRegistry()
    reg.register(_SourceNode())
    reg.register(_AddNode())
    return reg


def _chain_graph() -> Graph:
    return Graph(
        nodes=[
            NodeInstance(id="a", type="source", params={"value": 1}),
            NodeInstance(id="b", type="add", params={"delta": 1}),
            NodeInstance(id="c", type="add", params={"delta": 1}),
        ],
        edges=[
            Edge(id="e1", source="a", target="b"),
            Edge(id="e2", source="b", target="c"),
        ],
    )


def test_ancestors_through_target() -> None:
    graph = _chain_graph()
    assert ancestors_through_target(graph, "b") == {"a", "b"}
    assert ancestors_through_target(graph, "c") == {"a", "b", "c"}
    assert ancestors_through_target(graph, "a") == {"a"}


def test_ancestors_unknown_target() -> None:
    with pytest.raises(DagValidationError, match="Unknown target"):
        ancestors_through_target(_chain_graph(), "missing")


def test_executor_stops_at_target(tmp_path) -> None:
    executor = DagExecutor(tmp_path, node_registry=_registry())
    request = ExecuteRequest(
        graph=_chain_graph(),
        seed=0,
        sample_count=1,
        cache=False,
        target_node_id="b",
    )
    preview_nodes: list[str] = []
    result = executor.execute(
        request,
        on_event=lambda event: preview_nodes.append(event.node_id or "")
        if event.type.value == "preview" and event.node_id
        else None,
    )
    assert result["order"] == ["a", "b"]
    assert "c" not in result["order"]
    assert set(preview_nodes) == {"a", "b"}
