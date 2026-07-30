"""DAG validation, topological sort, and cached execution."""

from __future__ import annotations

import base64
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.engine.cache import CacheManager, is_image_value
from app.engine.registry import NodeRegistry, registry
from app.engine.run_context import current_sample_index
from app.engine.save_bundle import SaveBundle, current_save_bundle
from app.models.graph import (
    Edge,
    ExecuteRequest,
    ExecutionEvent,
    ExecutionEventType,
    Graph,
    NodeInstance,
    PortDirection,
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


def _as_image(value: Any) -> np.ndarray | None:
    if value is None or not is_image_value(value):
        return None
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, np.ndarray) else None


def _draw_annotation_overlay(
    image: np.ndarray,
    bboxes: list[Any] | None = None,
    keypoints: list[Any] | None = None,
) -> np.ndarray:
    """Draw Pascal-VOC bboxes and xy keypoints onto a BGR copy of image."""
    canvas = image if image.ndim == 3 else cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    canvas = canvas.copy()
    if bboxes:
        for box in bboxes:
            if not isinstance(box, (list, tuple)) or len(box) < 4:
                continue
            x1, y1, x2, y2 = (int(round(float(v))) for v in box[:4])
            cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 220, 80), 2)
            if len(box) >= 5:
                label = str(box[4])
                cv2.putText(
                    canvas,
                    label,
                    (x1, max(0, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.4,
                    (0, 220, 80),
                    1,
                    cv2.LINE_AA,
                )
    if keypoints:
        for point in keypoints:
            if not isinstance(point, (list, tuple)) or len(point) < 2:
                continue
            x, y = int(round(float(point[0]))), int(round(float(point[1])))
            cv2.circle(canvas, (x, y), 4, (40, 120, 255), -1, lineType=cv2.LINE_AA)
    return canvas


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

        source_impl = node_registry.get(nodes[edge.source].type)
        target_impl = node_registry.get(nodes[edge.target].type)
        source_ports = {
            port.id for port in source_impl.ports if port.direction == PortDirection.OUTPUT
        }
        target_ports = {
            port.id for port in target_impl.ports if port.direction == PortDirection.INPUT
        }
        if source_ports and edge.source_port not in source_ports:
            raise DagValidationError(
                f"Unknown source port '{edge.source_port}' on node '{edge.source}'"
            )
        if target_ports and edge.target_port not in target_ports:
            raise DagValidationError(
                f"Unknown target port '{edge.target_port}' on node '{edge.target}'"
            )

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


def ancestors_through_target(graph: Graph, target_node_id: str) -> set[str]:
    """Return target plus all upstream ancestors (via incoming edges)."""
    node_ids = {node.id for node in graph.nodes}
    if target_node_id not in node_ids:
        raise DagValidationError(f"Unknown target node '{target_node_id}'")

    parents: dict[str, list[str]] = defaultdict(list)
    for edge in graph.edges:
        parents[edge.target].append(edge.source)

    keep: set[str] = set()
    stack = [target_node_id]
    while stack:
        current = stack.pop()
        if current in keep:
            continue
        keep.add(current)
        stack.extend(parents.get(current, []))
    return keep


def _encode_preview(image: np.ndarray) -> str:
    success, buffer = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError("Failed to encode preview image")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def _collect_inputs(
    node_id: str,
    edges: list[Edge],
    outputs: dict[str, dict[str, Any]],
    sample_index: int = 0,
) -> dict[str, Any]:
    incoming = [edge for edge in edges if edge.target == node_id]
    inputs: dict[str, Any] = {}
    grouped: dict[str, list[Any]] = defaultdict(list)

    for edge in incoming:
        source_outputs = outputs.get(edge.source, {})
        value = source_outputs.get(edge.source_port)
        if value is None and edge.source_port == "image" and len(source_outputs) == 1:
            value = next(iter(source_outputs.values()))
        if value is None:
            continue
        # Fan-out batch image inputs one image per sample so unary nodes keep working.
        if (
            isinstance(value, list)
            and value
            and all(isinstance(item, np.ndarray) for item in value)
        ):
            grouped[edge.target_port].append(value[sample_index % len(value)])
        else:
            grouped[edge.target_port].append(value)

    for port, values in grouped.items():
        inputs[port] = values[0] if len(values) == 1 else values

    return inputs


def _input_hashes(
    inputs: dict[str, Any],
    cache: CacheManager,
) -> dict[str, str]:
    return {port: cache.hash_value(value) for port, value in inputs.items()}


def _emit_port_previews(
    *,
    emit: ProgressCallback,
    node_id: str,
    produced: dict[str, Any],
    sample_index: int,
    cache_hit: bool,
    sample_previews: dict[str, Any],
) -> None:
    port_previews: dict[str, Any] = {}
    annotation_data: dict[str, Any] = {}
    bboxes = produced.get("bboxes") if isinstance(produced.get("bboxes"), list) else None
    keypoints = produced.get("keypoints") if isinstance(produced.get("keypoints"), list) else None

    for port_id, value in produced.items():
        if is_image_value(value):
            if isinstance(value, list):
                encoded_list: list[str] = []
                for index, image in enumerate(value):
                    preview = _encode_preview(image)
                    encoded_list.append(preview)
                    emit(
                        ExecutionEvent(
                            type=ExecutionEventType.PREVIEW,
                            node_id=node_id,
                            port_id=port_id,
                            image_b64=preview,
                            sample_index=index,
                            cache_hit=cache_hit,
                        )
                    )
                if encoded_list:
                    port_previews[port_id] = encoded_list
                continue

            image = _as_image(value)
            if image is None:
                continue
            if port_id == "image" and (bboxes or keypoints):
                image = _draw_annotation_overlay(image, bboxes=bboxes, keypoints=keypoints)
            preview = _encode_preview(image)
            port_previews[port_id] = preview
            emit(
                ExecutionEvent(
                    type=ExecutionEventType.PREVIEW,
                    node_id=node_id,
                    port_id=port_id,
                    image_b64=preview,
                    sample_index=sample_index,
                    cache_hit=cache_hit,
                    data=(
                        {"bboxes": bboxes, "keypoints": keypoints}
                        if port_id == "image" and (bboxes or keypoints)
                        else None
                    ),
                )
            )
            continue

        # Annotation payloads (bboxes / keypoints / other JSON-serializable).
        annotation_data[port_id] = value
        emit(
            ExecutionEvent(
                type=ExecutionEventType.PREVIEW,
                node_id=node_id,
                port_id=port_id,
                sample_index=sample_index,
                cache_hit=cache_hit,
                data={port_id: value},
            )
        )

    if annotation_data:
        port_previews["__annotations__"] = annotation_data
    if port_previews:
        sample_previews[node_id] = port_previews


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
        if request.target_node_id:
            keep = ancestors_through_target(request.graph, request.target_node_id)
            order = [node_id for node_id in order if node_id in keep]
        sample_count = max(1, request.sample_count)
        results: dict[str, Any] = {"order": order, "samples": []}
        save_bundle = SaveBundle()
        bundle_token = current_save_bundle.set(save_bundle)

        def emit(event: ExecutionEvent) -> None:
            if on_event is not None:
                on_event(event)

        try:
            for sample_index in range(sample_count):
                cancel.check()
                sample_seed = request.seed + sample_index
                sample_token = current_sample_index.set(sample_index)
                outputs: dict[str, dict[str, Any]] = {}
                sample_previews: dict[str, Any] = {}

                try:
                    for index, node_id in enumerate(order):
                        cancel.check()
                        instance = nodes[node_id]
                        node_impl = self.registry.get(instance.type)
                        params = node_impl.validate_params(instance.params)
                        node_impl.prepare_run(params)
                        inputs = _collect_inputs(
                            node_id,
                            request.graph.edges,
                            outputs,
                            sample_index=sample_index,
                        )
                        input_hash_map = _input_hashes(inputs, self.cache)
                        cache_key = self.cache.make_key(
                            instance.type, params, input_hash_map, sample_seed
                        )

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
                        produced: dict[str, Any]
                        started = time.perf_counter()
                        use_cache = request.cache and node_impl.cacheable
                        if use_cache and self.cache.has_outputs(cache_key):
                            cached = self.cache.get_outputs(cache_key)
                            if cached is not None:
                                produced = cached
                                outputs[node_id] = produced
                                cache_hit = True

                        if not cache_hit:
                            produced = node_impl.execute(inputs, params, seed=sample_seed)
                            outputs[node_id] = produced
                            if use_cache:
                                self.cache.put_outputs(
                                    cache_key,
                                    produced,
                                    meta={"node_id": node_id, "type": instance.type},
                                )

                        duration_ms = (time.perf_counter() - started) * 1000.0
                        emit(
                            ExecutionEvent(
                                type=ExecutionEventType.PROGRESS,
                                node_id=node_id,
                                progress=(index + 1) / len(order),
                                sample_index=sample_index,
                                cache_hit=cache_hit,
                                duration_ms=duration_ms,
                                message=(
                                    f"Finished {instance.type} in {duration_ms:.1f}ms"
                                    + (" (cache)" if cache_hit else "")
                                ),
                            )
                        )

                        _emit_port_previews(
                            emit=emit,
                            node_id=node_id,
                            produced=produced,
                            sample_index=sample_index,
                            cache_hit=cache_hit,
                            sample_previews=sample_previews,
                        )

                    results["samples"].append(
                        {
                            "sample_index": sample_index,
                            "seed": sample_seed,
                            "previews": sample_previews,
                        }
                    )
                finally:
                    current_sample_index.reset(sample_token)

            if save_bundle.files:
                zip_path = save_bundle.write_zip()
                download_name = zip_path.name
                emit(
                    ExecutionEvent(
                        type=ExecutionEventType.DOWNLOAD,
                        message=f"Ready to download {len(save_bundle.files)} image(s)",
                        download_url=f"/api/downloads/{download_name}",
                        download_filename=download_name,
                        data={"count": len(save_bundle.files)},
                    )
                )
                results["download_url"] = f"/api/downloads/{download_name}"
                results["download_filename"] = download_name

            emit(ExecutionEvent(type=ExecutionEventType.DONE, message="Execution complete"))
            return results
        finally:
            current_save_bundle.reset(bundle_token)
