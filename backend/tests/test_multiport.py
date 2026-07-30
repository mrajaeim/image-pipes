"""Tests for multi-output nodes such as split/merge channels."""

from __future__ import annotations

import cv2
import numpy as np

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes


def _request(path: str, with_merge: bool = True) -> ExecuteRequest:
    nodes = [
        NodeInstance(id="load", type="load_image", params={"path": path}),
        NodeInstance(id="split", type="split_channels", params={}),
    ]
    edges = [
        Edge(
            id="e1",
            source="load",
            source_port="image",
            target="split",
            target_port="image",
        ),
    ]
    if with_merge:
        nodes.append(NodeInstance(id="merge", type="merge_channels", params={}))
        edges.extend(
            [
                Edge(id="e2", source="split", source_port="b", target="merge", target_port="b"),
                Edge(id="e3", source="split", source_port="g", target="merge", target_port="g"),
                Edge(id="e4", source="split", source_port="r", target="merge", target_port="r"),
            ]
        )
    return ExecuteRequest(graph=Graph(nodes=nodes, edges=edges), seed=0, cache=True)


def test_split_channels_emits_all_ports(tmp_path) -> None:
    register_builtin_nodes()
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    image[:, :] = (10, 20, 30)
    path = tmp_path / "in.png"
    cv2.imwrite(str(path), image)

    events: list[tuple[str, str | None]] = []
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    result = executor.execute(
        _request(str(path), with_merge=True),
        on_event=lambda event: events.append((event.type.value, event.port_id))
        if event.type.value == "preview"
        else None,
    )

    assert result["order"] == ["load", "split", "merge"]
    preview_ports = [port for kind, port in events if kind == "preview"]
    assert "b" in preview_ports
    assert "g" in preview_ports
    assert "r" in preview_ports
    assert "image" in preview_ports


def test_cache_restores_multi_port_outputs(tmp_path) -> None:
    register_builtin_nodes()
    image = np.zeros((6, 6, 3), dtype=np.uint8)
    image[:, :] = (5, 15, 25)
    path = tmp_path / "in.png"
    cv2.imwrite(str(path), image)

    request = _request(str(path), with_merge=False)
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    hits: list[bool | None] = []
    executor.execute(request)
    executor.execute(
        request,
        on_event=lambda event: hits.append(event.cache_hit)
        if event.type.value == "preview" and event.node_id == "split"
        else None,
    )
    assert any(hit is True for hit in hits)
