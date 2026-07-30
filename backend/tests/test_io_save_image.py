"""Tests for Save Image path templates and multi-sample writes."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.engine.run_context import current_sample_index, current_source_stems
from app.main import app
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes
from app.nodes.io import resolve_save_path


def test_resolve_save_path_templates(tmp_path) -> None:
    when = datetime(2026, 7, 30, 22, 55, 1)
    path = resolve_save_path(
        str(tmp_path),
        "{filename}_{index}_{time}.png",
        index=2,
        filename="lena",
        when=when,
    )
    assert path == tmp_path / "lena_2_20260730_225501.png"


def test_resolve_save_path_auto_index_when_missing(tmp_path) -> None:
    path = resolve_save_path(
        str(tmp_path),
        "output.png",
        index=3,
        filename="x",
        when=datetime(2026, 1, 1, 0, 0, 0),
    )
    assert path.name == "output_3.png"


def test_resolve_save_path_requires_directory() -> None:
    with pytest.raises(ValueError, match="Output folder is required"):
        resolve_save_path(
            "  ",
            "{index}.png",
            index=0,
            filename="a",
            when=datetime(2026, 1, 1, 0, 0, 0),
        )


def test_save_image_requires_directory() -> None:
    register_builtin_nodes()
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="output folder"):
        registry.get("save_image").execute(
            {"image": image},
            {"directory": "", "filename": "{index}.png"},
            seed=0,
        )


def test_save_image_uses_templates(tmp_path) -> None:
    register_builtin_nodes()
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    image[:, :] = (10, 20, 30)
    token_i = current_sample_index.set(1)
    token_s = current_source_stems.set(["photo"])
    try:
        out = registry.get("save_image").execute(
            {"image": image},
            {"directory": str(tmp_path), "filename": "{filename}_{index}.png"},
            seed=0,
        )["image"]
    finally:
        current_sample_index.reset(token_i)
        current_source_stems.reset(token_s)

    assert out.shape == image.shape
    saved = tmp_path / "photo_1.png"
    assert saved.is_file()
    loaded = cv2.imread(str(saved))
    assert loaded is not None
    assert tuple(loaded[0, 0]) == (10, 20, 30)


def test_save_image_batch_writes_unique_files(tmp_path) -> None:
    register_builtin_nodes()
    a = np.full((2, 2, 3), 1, dtype=np.uint8)
    b = np.full((2, 2, 3), 2, dtype=np.uint8)
    path_a = tmp_path / "a.png"
    path_b = tmp_path / "b.png"
    cv2.imwrite(str(path_a), a)
    cv2.imwrite(str(path_b), b)
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(
                    id="load",
                    type="load_image",
                    params={"path": str(tmp_path)},
                ),
                NodeInstance(
                    id="save",
                    type="save_image",
                    params={
                        "directory": str(out_dir),
                        "filename": "{filename}_{index}.png",
                    },
                ),
            ],
            edges=[
                Edge(
                    id="e1",
                    source="load",
                    source_port="image",
                    target="save",
                    target_port="image",
                )
            ],
        ),
        seed=0,
        sample_count=2,
        cache=True,
    )
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    executor.execute(request)

    assert (out_dir / "a_0.png").is_file()
    assert (out_dir / "b_1.png").is_file()


def test_create_output_directory(tmp_path, monkeypatch) -> None:
    outputs = tmp_path / "outputs"
    monkeypatch.setattr("app.api.routes.OUTPUT_DIR", outputs)
    client = TestClient(app)
    response = client.post("/api/outputs")
    assert response.status_code == 200
    body = response.json()
    assert Path(body["path"]).is_dir()
    assert Path(body["path"]).parent == outputs.resolve()
