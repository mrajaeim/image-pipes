"""API tests for versioned user scripts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.engine.registry import registry
from app.main import app

GOOD_CODE = "def process(image, seed=0):\n    return image\n"
V2_CODE = "def process(image, seed=0):\n    return image + 1\n"


def test_user_scripts_crud_and_nodes_catalog(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    client = TestClient(app)

    listed = client.get("/api/user-scripts")
    assert listed.status_code == 200
    assert listed.json() == []

    created = client.post(
        "/api/user-scripts",
        json={"name": "My Sepia", "code": GOOD_CODE},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["id"] == "script_001"
    assert body["name"] == "My Sepia"
    assert body["current_version"] == 1
    assert body["node_type"] == "user_script.script_001"
    assert registry.has("user_script.script_001")

    nodes = client.get("/api/nodes")
    assert nodes.status_code == 200
    types = {item["type"] for item in nodes.json()}
    assert "user_script.script_001" in types

    code_resp = client.get("/api/user-scripts/script_001/versions/1")
    assert code_resp.status_code == 200
    assert code_resp.json()["code"] == GOOD_CODE

    versioned = client.post(
        "/api/user-scripts/script_001/versions",
        json={"code": V2_CODE},
    )
    assert versioned.status_code == 200
    assert versioned.json()["current_version"] == 2

    v1 = client.get("/api/user-scripts/script_001/versions/1")
    v2 = client.get("/api/user-scripts/script_001/versions/2")
    assert v1.json()["code"] == GOOD_CODE
    assert v2.json()["code"] == V2_CODE

    all_scripts = client.get("/api/user-scripts")
    assert len(all_scripts.json()) == 1
    assert all_scripts.json()[0]["current_version"] == 2


def test_user_scripts_reject_bad_code_and_ids(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_PIPES_DATA_DIR", str(tmp_path))
    client = TestClient(app)

    bad = client.post(
        "/api/user-scripts",
        json={"name": "Bad", "code": "def nope(image):\n    return image\n"},
    )
    assert bad.status_code == 400

    empty_name = client.post(
        "/api/user-scripts",
        json={"name": "  ", "code": GOOD_CODE},
    )
    assert empty_name.status_code == 422 or empty_name.status_code == 400

    missing = client.get("/api/user-scripts/script_999/versions/1")
    assert missing.status_code in (400, 404)

    bad_id = client.get("/api/user-scripts/not_a_script/versions/1")
    assert bad_id.status_code == 400
