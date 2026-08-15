"""Tests for user_script registry nodes."""

from __future__ import annotations

import numpy as np
import pytest

from app.engine.registry import registry
from app.nodes import register_builtin_nodes
from app.nodes.user_script import refresh_user_script, register_user_scripts
from app.services import user_scripts as store


def test_register_and_execute_pinned_versions(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    # Re-bind store root via env for paths.user_scripts_dir
    meta = store.create_script(
        "Invert-ish",
        "def process(image, seed=0):\n    return image + 1\n",
        tmp_path / "user_scripts",
    )
    store.add_version(
        meta.id,
        "def process(image, seed=0):\n    return image + 5\n",
        tmp_path / "user_scripts",
    )

    register_builtin_nodes()
    register_user_scripts()
    node_type = meta.node_type()
    assert registry.has(node_type)

    image = np.zeros((4, 4, 3), dtype=np.uint8)
    v1 = registry.get(node_type).execute({"image": image}, {"version": 1}, seed=0)["image"]
    v2 = registry.get(node_type).execute({"image": image}, {"version": 2}, seed=0)["image"]
    np.testing.assert_array_equal(v1, image + 1)
    np.testing.assert_array_equal(v2, image + 5)


def test_refresh_user_script_after_create(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    register_builtin_nodes()
    register_user_scripts()
    before = {m.type for m in registry.list_metadata()}

    meta = store.create_script(
        "New",
        "def process(image, seed=0):\n    return image\n",
        tmp_path / "user_scripts",
    )
    refresh_user_script(meta.id)
    assert meta.node_type() in {m.type for m in registry.list_metadata()}
    assert meta.node_type() not in before


def test_missing_version_raises(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    meta = store.create_script(
        "X",
        "def process(image, seed=0):\n    return image\n",
        tmp_path / "user_scripts",
    )
    register_builtin_nodes()
    register_user_scripts()
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    with pytest.raises(FileNotFoundError):
        registry.get(meta.node_type()).execute({"image": image}, {"version": 9}, seed=0)


def test_executor_blocks_user_script_without_trust(tmp_path, monkeypatch) -> None:
    from app.engine.executor import DagExecutor
    from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
    from app.nodes.custom import graph_has_custom_code

    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    meta = store.create_script(
        "Gate",
        "def process(image, seed=0):\n    return image\n",
        tmp_path / "user_scripts",
    )
    register_builtin_nodes()
    register_user_scripts()

    graph = Graph(
        nodes=[
            NodeInstance(id="src", type="blank_image", params={"width": 8, "height": 8}),
            NodeInstance(
                id="usr",
                type=meta.node_type(),
                params={"version": 1},
            ),
        ],
        edges=[
            Edge(
                id="e1",
                source="src",
                source_port="image",
                target="usr",
                target_port="image",
            ),
        ],
    )
    assert graph_has_custom_code(graph.nodes)

    from app.engine.executor import DagValidationError

    executor = DagExecutor(tmp_path / "cache")
    with pytest.raises(DagValidationError, match="Trust the custom code"):
        executor.execute(ExecuteRequest(graph=graph, allow_custom_code=False))

    result = executor.execute(ExecuteRequest(graph=graph, allow_custom_code=True))
    assert "order" in result
