"""Tests for upload and delete endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_sample_image_returns_lena() -> None:
    client = TestClient(app)
    response = client.get("/api/sample-image")
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("image/")
    assert len(response.content) > 100


def test_delete_uploaded_file(tmp_path, monkeypatch) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr("app.api.routes.UPLOAD_DIR", uploads)

    batch = uploads / "batch1"
    batch.mkdir()
    target = batch / "a.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")

    client = TestClient(app)
    response = client.delete("/api/uploads", params={"path": str(target.resolve())})
    assert response.status_code == 200
    assert not target.exists()
    assert not batch.exists()


def test_delete_rejects_path_outside_uploads(tmp_path, monkeypatch) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr("app.api.routes.UPLOAD_DIR", uploads)

    outside = tmp_path / "other.png"
    outside.write_bytes(b"x")

    client = TestClient(app)
    response = client.delete("/api/uploads", params={"path": str(outside.resolve())})
    assert response.status_code == 400


def test_upload_append_to_existing_batch(tmp_path, monkeypatch) -> None:
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr("app.api.routes.UPLOAD_DIR", uploads)

    client = TestClient(app)
    first = client.post(
        "/api/uploads",
        files=[("files", ("a.png", b"\x89PNG\r\n\x1a\n", "image/png"))],
    )
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["count"] == 1
    batch_dir = str(Path(first_body["files"][0]).parent)

    second = client.post(
        "/api/uploads",
        params={"append_to": batch_dir},
        files=[("files", ("b.png", b"\x89PNG\r\n\x1a\n", "image/png"))],
    )
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["kind"] == "folder"
    assert second_body["count"] == 1
    assert Path(second_body["files"][0]).parent == Path(batch_dir)
    assert Path(batch_dir).joinpath("a.png").is_file()
    assert Path(batch_dir).joinpath("b.png").is_file()
