"""Executor emits LOG events from script log() helpers."""

from __future__ import annotations

from app.engine.executor import DagExecutor
from app.models.graph import Edge, ExecuteRequest, ExecutionEventType, Graph, NodeInstance
from app.nodes import register_builtin_nodes


def test_executor_emits_script_log_events(tmp_path) -> None:
    register_builtin_nodes()
    events = []
    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(id="src", type="blank_image", params={"width": 8, "height": 8}),
                NodeInstance(
                    id="custom",
                    type="custom_python",
                    params={
                        "code": (
                            "def process(image, seed=0):\n"
                            "    log('hello', image)\n"
                            "    return image\n"
                        ),
                    },
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
        cache=False,
    )
    DagExecutor(tmp_path / "cache").execute(request, on_event=events.append)
    log_events = [e for e in events if e.type == ExecutionEventType.LOG]
    assert len(log_events) == 1
    assert log_events[0].node_id == "custom"
    assert log_events[0].message is not None
    assert "hello" in log_events[0].message
    assert "ndarray(shape=" in log_events[0].message
