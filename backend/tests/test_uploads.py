"""Tests for upload and delete endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


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
