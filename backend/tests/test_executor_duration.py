"""Tests for per-node execution duration events."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.engine.executor import DagExecutor
from app.engine.registry import BaseNode, NodeRegistry
from app.models.graph import (
    ExecuteRequest,
    ExecutionEvent,
    ExecutionEventType,
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


def test_progress_events_include_duration_ms(tmp_path) -> None:
    reg = NodeRegistry()
    reg.register(_SourceNode())
    executor = DagExecutor(tmp_path, node_registry=reg)
    request = ExecuteRequest(
        graph=Graph(
            nodes=[NodeInstance(id="a", type="source", params={"value": 3})],
            edges=[],
        ),
        seed=0,
        sample_count=1,
        cache=False,
    )
    events: list[ExecutionEvent] = []
    executor.execute(request, on_event=events.append)

    timed = [
        event
        for event in events
        if event.type == ExecutionEventType.PROGRESS and event.duration_ms is not None
    ]
    assert timed
    assert timed[0].node_id == "a"
    assert timed[0].duration_ms is not None
    assert timed[0].duration_ms >= 0.0
    assert timed[0].cache_hit is False
