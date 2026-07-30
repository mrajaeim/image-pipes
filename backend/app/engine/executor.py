"""DAG validation, topological sort, and cached execution."""

from __future__ import annotations

import base64
import threading
from collections import defaultdict, deque
from collections.abc import Callable
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.engine.cache import CacheManager
from app.engine.registry import NodeRegistry, registry
from app.models.graph import (
    Edge,
    ExecuteRequest,
    ExecutionEvent,
    ExecutionEventType,
    Graph,
    NodeInstance,
)


class DagValidationError(ValueError):
    """Raised when a graph cannot be executed."""


class CancellationToken:
    def __init__(self) -> None:
        self._event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()

    def check(self) -> None:
        if self.cancelled:
            raise InterruptedError("Execution cancelled")


ProgressCallback = Callable[[ExecutionEvent], None]


def validate_graph(graph: Graph, node_registry: NodeRegistry = registry) -> dict[str, NodeInstance]:
    nodes = {node.id: node for node in graph.nodes}
    if len(nodes) != len(graph.nodes):
        raise DagValidationError("Duplicate node ids in graph")

    for node in graph.nodes:
        if not node_registry.has(node.type):
            raise DagValidationError(f"Unknown node type '{node.type}'")

    for edge in graph.edges:
        if edge.source not in nodes:
            raise DagValidationError(f"Edge source '{edge.source}' not found")
        if edge.target not in nodes:
            raise DagValidationError(f"Edge target '{edge.target}' not found")
        if edge.source == edge.target:
            raise DagValidationError(f"Self-loop on node '{edge.source}'")

    return nodes


def topological_sort(graph: Graph) -> list[str]:
    nodes = {node.id for node in graph.nodes}
    indegree: dict[str, int] = {node_id: 0 for node_id in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in graph.edges:
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] += 1

    queue = deque(sorted(node_id for node_id, degree in indegree.items() if degree == 0))
    order: list[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in sorted(adjacency[current]):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(nodes):
        raise DagValidationError("Graph contains a cycle")

    return order


def _encode_preview(image: np.ndarray) -> str:
    success, buffer = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError("Failed to encode preview image")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def _collect_inputs(
    node_id: str,
    edges: list[Edge],
    outputs: dict[str, dict[str, np.ndarray | list[np.ndarray]]],
) -> dict[str, np.ndarray | list[np.ndarray] | None]:
    incoming = [edge for edge in edges if edge.target == node_id]
    inputs: dict[str, np.ndarray | list[np.ndarray] | None] = {}
    grouped: dict[str, list[np.ndarray]] = defaultdict(list)

    for edge in incoming:
        source_outputs = outputs.get(edge.source, {})
        value = source_outputs.get(edge.source_port)
        if value is None:
            continue
        if isinstance(value, list):
            grouped[edge.target_port].extend(value)
        else:
            grouped[edge.target_port].append(value)

    for port, values in grouped.items():
        inputs[port] = values[0] if len(values) == 1 else values

    return inputs


def _input_hashes(
    inputs: dict[str, np.ndarray | list[np.ndarray] | None],
    cache: CacheManager,
) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for port, value in inputs.items():
        if value is None:
            hashes[port] = "none"
        elif isinstance(value, list):
            hashes[port] = cache.hash_payload([cache.hash_image(item) for item in value])
        else:
            hashes[port] = cache.hash_image(value)
    return hashes


class DagExecutor:
    def __init__(
        self,
        cache_dir: Path | str,
        node_registry: NodeRegistry | None = None,
    ) -> None:
        self.cache = CacheManager(cache_dir)
        self.registry = node_registry or registry

    def execute(
        self,
        request: ExecuteRequest,
        on_event: ProgressCallback | None = None,
        cancel: CancellationToken | None = None,
    ) -> dict[str, Any]:
        cancel = cancel or CancellationToken()
        nodes = validate_graph(request.graph, self.registry)
        order = topological_sort(request.graph)
        sample_count = max(1, request.sample_count)
        results: dict[str, Any] = {"order": order, "samples": []}

        def emit(event: ExecutionEvent) -> None:
            if on_event is not None:
                on_event(event)

        for sample_index in range(sample_count):
            cancel.check()
            sample_seed = request.seed + sample_index
            outputs: dict[str, dict[str, np.ndarray | list[np.ndarray]]] = {}
            sample_previews: dict[str, str] = {}

            for index, node_id in enumerate(order):
                cancel.check()
                instance = nodes[node_id]
                node_impl = self.registry.get(instance.type)
                params = node_impl.validate_params(instance.params)
                inputs = _collect_inputs(node_id, request.graph.edges, outputs)
                input_hash_map = _input_hashes(inputs, self.cache)
                cache_key = self.cache.make_key(instance.type, params, input_hash_map, sample_seed)

                emit(
                    ExecutionEvent(
                        type=ExecutionEventType.PROGRESS,
                        node_id=node_id,
                        progress=(index + 1) / len(order),
                        sample_index=sample_index,
                        message=f"Executing {instance.type}",
                    )
                )

                cache_hit = False
                primary: np.ndarray | None = None
                if request.cache and self.cache.has(cache_key):
                    cached = self.cache.get(cache_key)
                    if cached is not None:
                        outputs[node_id] = {"image": cached}
                        primary = cached
                        cache_hit = True

                if not cache_hit:
                    produced = node_impl.execute(inputs, params, seed=sample_seed)
                    outputs[node_id] = produced
                    primary_value = produced.get("image")
                    if isinstance(primary_value, list) and primary_value:
                        primary = primary_value[0]
                    elif isinstance(primary_value, np.ndarray):
                        primary = primary_value
                    if request.cache and primary is not None:
                        self.cache.put(
                            cache_key,
                            primary,
                            meta={"node_id": node_id, "type": instance.type},
                        )

                if primary is not None:
                    preview = _encode_preview(primary)
                    sample_previews[node_id] = preview
                    emit(
                        ExecutionEvent(
                            type=ExecutionEventType.PREVIEW,
                            node_id=node_id,
                            image_b64=preview,
                            sample_index=sample_index,
                            cache_hit=cache_hit,
                        )
                    )

            results["samples"].append(
                {
                    "sample_index": sample_index,
                    "seed": sample_seed,
                    "previews": sample_previews,
                }
            )

        emit(ExecutionEvent(type=ExecutionEventType.DONE, message="Execution complete"))
        return results
