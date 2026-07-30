"""Tests for Save Image ZIP download flow."""

from __future__ import annotations

from datetime import datetime

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.engine.run_context import current_sample_index, current_source_stems
from app.engine.save_bundle import SaveBundle, current_save_bundle
from app.main import app
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes
from app.nodes.io import resolve_save_filename


def test_resolve_save_filename_templates() -> None:
    when = datetime(2026, 7, 30, 22, 55, 1)
    name = resolve_save_filename(
        "{filename}_{index}_{time}.png",
        index=2,
        filename="lena",
        when=when,
    )
    assert name == "lena_2_20260730_225501.png"


def test_resolve_save_filename_auto_index_when_missing() -> None:
    name = resolve_save_filename(
        "output.png",
        index=3,
        filename="x",
        when=datetime(2026, 1, 1, 0, 0, 0),
    )
    assert name == "output_3.png"


def test_save_image_adds_to_bundle(tmp_path, monkeypatch) -> None:
    register_builtin_nodes()
    monkeypatch.setattr("app.engine.save_bundle.DOWNLOAD_DIR", tmp_path / "downloads")
    image = np.zeros((4, 4, 3), dtype=np.uint8)
    image[:, :] = (10, 20, 30)
    bundle = SaveBundle()
    token_b = current_save_bundle.set(bundle)
    token_i = current_sample_index.set(1)
    token_s = current_source_stems.set(["photo"])
    try:
        out = registry.get("save_image").execute(
            {"image": image},
            {"filename": "{filename}_{index}.png"},
            seed=0,
        )["image"]
    finally:
        current_save_bundle.reset(token_b)
        current_sample_index.reset(token_i)
        current_source_stems.reset(token_s)

    assert out.shape == image.shape
    assert "photo_1.png" in bundle.files
    assert len(bundle.files["photo_1.png"]) > 0


def test_executor_emits_download_zip(tmp_path, monkeypatch) -> None:
    register_builtin_nodes()
    monkeypatch.setattr("app.engine.save_bundle.DOWNLOAD_DIR", tmp_path / "downloads")
    a = np.full((2, 2, 3), 1, dtype=np.uint8)
    b = np.full((2, 2, 3), 2, dtype=np.uint8)
    path_a = tmp_path / "a.png"
    path_b = tmp_path / "b.png"
    cv2.imwrite(str(path_a), a)
    cv2.imwrite(str(path_b), b)

    events: list[str] = []
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
                    params={"filename": "{filename}_{index}.png"},
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
        cache=False,
    )
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    result = executor.execute(
        request,
        on_event=lambda event: events.append(event.type.value),
    )

    assert "download" in events
    assert result["download_url"].startswith("/api/downloads/")
    zip_name = result["download_filename"]
    zip_path = tmp_path / "downloads" / zip_name
    assert zip_path.is_file()

    client = TestClient(app)
    # Point API download dir to the same temp folder used by the executor.
    monkeypatch.setattr("app.engine.save_bundle.DOWNLOAD_DIR", tmp_path / "downloads")
    response = client.get(f"/api/downloads/{zip_name}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
