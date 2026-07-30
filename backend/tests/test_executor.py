"""Tests for DAG topological sort and cached execution."""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest

from app.engine.executor import DagExecutor, DagValidationError, topological_sort, validate_graph
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
        image = np.full((4, 4), int(params["value"]) + seed, dtype=np.uint8)
        return {"image": image}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = np.full((4, 4), {params['value']})"]


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


def test_topological_sort_order() -> None:
    graph = Graph(
        nodes=[
            NodeInstance(id="a", type="source"),
            NodeInstance(id="b", type="add"),
            NodeInstance(id="c", type="add"),
        ],
        edges=[
            Edge(id="e1", source="a", target="b"),
            Edge(id="e2", source="b", target="c"),
        ],
    )
    assert topological_sort(graph) == ["a", "b", "c"]


def test_cycle_detection() -> None:
    graph = Graph(
        nodes=[
            NodeInstance(id="a", type="source"),
            NodeInstance(id="b", type="add"),
        ],
        edges=[
            Edge(id="e1", source="a", target="b"),
            Edge(id="e2", source="b", target="a"),
        ],
    )
    with pytest.raises(DagValidationError, match="cycle"):
        topological_sort(graph)


def test_unknown_node_validation() -> None:
    graph = Graph(nodes=[NodeInstance(id="a", type="missing")], edges=[])
    with pytest.raises(DagValidationError, match="Unknown node type"):
        validate_graph(graph, _registry())


def test_executor_order_and_cache(tmp_path) -> None:
    reg = _registry()
    executor = DagExecutor(tmp_path, node_registry=reg)
    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(id="a", type="source", params={"value": 5}),
                NodeInstance(id="b", type="add", params={"delta": 2}),
            ],
            edges=[Edge(id="e1", source="a", target="b")],
        ),
        seed=0,
        sample_count=1,
        cache=True,
    )
    events: list[str] = []
    first = executor.execute(request, on_event=lambda event: events.append(event.type.value))
    assert first["order"] == ["a", "b"]
    assert "done" in events
    assert "preview" in events

    second_events: list[bool | None] = []
    executor.execute(
        request,
        on_event=lambda event: second_events.append(event.cache_hit)
        if event.type.value == "preview"
        else None,
    )
    assert any(hit is True for hit in second_events)
