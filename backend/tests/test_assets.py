"""Tests for asset registration and Load Image asset_batch_id."""

from __future__ import annotations

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.main import app
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes
from app.services import assets as assets_service


def test_register_local_paths(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    assets_service.clear_registry()

    image = np.zeros((4, 4, 3), dtype=np.uint8)
    file_a = tmp_path / "a.png"
    file_b = tmp_path / "b.png"
    cv2.imwrite(str(file_a), image)
    cv2.imwrite(str(file_b), image)

    client = TestClient(app)
    response = client.post(
        "/api/assets/register",
        json={"paths": [str(file_a), str(file_b)], "as_folder": False},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    batch_id = body["batch"]["id"]

    listed = client.get(f"/api/assets/{batch_id}")
    assert listed.status_code == 200
    assert listed.json()["count"] == 2

    preview = client.get(f"/api/assets/{batch_id}/files/a.png")
    assert preview.status_code == 200


def test_upload_returns_asset_batch_id(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    assets_service.clear_registry()
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr("app.api.routes.UPLOAD_DIR", uploads)

    client = TestClient(app)
    response = client.post(
        "/api/uploads",
        files=[("files", ("a.png", b"\x89PNG\r\n\x1a\n", "image/png"))],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["asset_batch_id"]
    assert assets_service.get_batch(body["asset_batch_id"]) is not None


def test_load_image_resolves_asset_batch(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    assets_service.clear_registry()
    register_builtin_nodes()

    image = np.full((2, 2, 3), 7, dtype=np.uint8)
    file_a = tmp_path / "photo.png"
    cv2.imwrite(str(file_a), image)
    batch = assets_service.register_paths([str(file_a)])

    out = registry.get("load_image").execute(
        {},
        {"path": "", "asset_batch_id": batch.id},
        seed=0,
    )["image"]
    assert isinstance(out, list)
    assert len(out) == 1
    assert out[0].shape == (2, 2, 3)


def test_save_image_writes_output_dir(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    assets_service.clear_registry()
    register_builtin_nodes()

    image = np.full((2, 2, 3), 3, dtype=np.uint8)
    src = tmp_path / "in.png"
    cv2.imwrite(str(src), image)
    out_dir = tmp_path / "results"
    events: list[str] = []

    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(
                    id="load",
                    type="load_image",
                    params={"path": str(src)},
                ),
                NodeInstance(
                    id="save",
                    type="save_image",
                    params={
                        "filename": "{filename}_{index}.png",
                        "output_dir": str(out_dir),
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
        sample_count=1,
        cache=False,
    )
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    result = executor.execute(
        request,
        on_event=lambda event: events.append(event.type.value),
    )

    assert "saved" in events
    assert "download" not in events
    assert "download_url" not in result
    assert out_dir.is_dir()
    assert any(out_dir.iterdir())
