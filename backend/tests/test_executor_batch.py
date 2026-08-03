"""Batch image sets run fully under a single iteration."""

from __future__ import annotations

import cv2
import numpy as np

from app.engine.executor import DagExecutor, _batch_size_for_graph
from app.engine.registry import registry
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes


def test_batch_size_from_load_image_folder(tmp_path) -> None:
    for index, value in enumerate((10, 20, 30)):
        image = np.full((4, 4, 3), value, dtype=np.uint8)
        cv2.imwrite(str(tmp_path / f"img{index}.png"), image)

    graph = Graph(
        nodes=[
            NodeInstance(
                id="load",
                type="load_image",
                params={"path": str(tmp_path)},
            )
        ],
        edges=[],
    )
    assert _batch_size_for_graph(graph) == 3


def test_one_iteration_processes_entire_image_set(tmp_path) -> None:
    register_builtin_nodes()
    values = (11, 22, 33)
    for index, value in enumerate(values):
        image = np.full((4, 4, 3), value, dtype=np.uint8)
        cv2.imwrite(str(tmp_path / f"img{index}.png"), image)

    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(
                    id="load",
                    type="load_image",
                    params={"path": str(tmp_path)},
                ),
                NodeInstance(
                    id="blur",
                    type="gaussian_blur",
                    params={"ksize": 3, "sigma": 0},
                ),
            ],
            edges=[
                Edge(
                    id="e1",
                    source="load",
                    source_port="image",
                    target="blur",
                    target_port="image",
                )
            ],
        ),
        seed=0,
        sample_count=1,
        cache=False,
    )

    preview_indices: list[int] = []
    result = DagExecutor(tmp_path / "cache", node_registry=registry).execute(
        request,
        on_event=lambda event: preview_indices.append(event.sample_index)
        if event.type.value == "preview" and event.node_id == "blur"
        else None,
    )

    assert len(result["samples"]) == 3
    assert [sample["batch_index"] for sample in result["samples"]] == [0, 1, 2]
    assert [sample["iteration"] for sample in result["samples"]] == [0, 0, 0]
    assert [sample["seed"] for sample in result["samples"]] == [0, 0, 0]
    assert sorted(set(preview_indices)) == [0, 1, 2]


def test_two_iterations_repeat_full_set_with_seed_offset(tmp_path) -> None:
    register_builtin_nodes()
    for index, value in enumerate((5, 9)):
        image = np.full((4, 4, 3), value, dtype=np.uint8)
        cv2.imwrite(str(tmp_path / f"img{index}.png"), image)

    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(
                    id="load",
                    type="load_image",
                    params={"path": str(tmp_path)},
                )
            ],
            edges=[],
        ),
        seed=7,
        sample_count=2,
        cache=False,
    )
    load_preview_indices: list[int] = []
    result = DagExecutor(tmp_path / "cache", node_registry=registry).execute(
        request,
        on_event=lambda event: load_preview_indices.append(event.sample_index)
        if event.type.value == "preview" and event.node_id == "load"
        else None,
    )

    assert len(result["samples"]) == 4
    assert [(s["iteration"], s["batch_index"], s["seed"]) for s in result["samples"]] == [
        (0, 0, 7),
        (0, 1, 7),
        (1, 0, 8),
        (1, 1, 8),
    ]
    # Load Images previews stay keyed by batch index (not flat iteration×batch).
    assert sorted(set(load_preview_indices)) == [0, 1]
