"""Tests for versioned user script disk store."""

from __future__ import annotations

import pytest

from app.services import user_scripts as store


def test_allocate_script_ids(tmp_path) -> None:
    assert store.allocate_script_id(tmp_path) == "script_001"
    store.create_script("First", "def process(image, seed=0):\n    return image\n", tmp_path)
    assert store.allocate_script_id(tmp_path) == "script_002"


def test_create_writes_v1_and_meta(tmp_path) -> None:
    meta = store.create_script(
        "  Sepia Tone  ",
        "def process(image, seed=0):\n    return image\n",
        tmp_path,
    )
    assert meta.id == "script_001"
    assert meta.name == "Sepia Tone"
    assert meta.current_version == 1
    assert (tmp_path / "script_001" / "meta.json").is_file()
    assert (tmp_path / "script_001" / "v1" / "process.py").is_file()
    code = store.read_code("script_001", 1, tmp_path)
    assert "def process" in code


def test_add_version_preserves_old(tmp_path) -> None:
    store.create_script(
        "Blur",
        "def process(image, seed=0):\n    return image\n",
        tmp_path,
    )
    v1 = store.read_code("script_001", 1, tmp_path)
    meta = store.add_version(
        "script_001",
        "def process(image, seed=0):\n    return image + 1\n",
        tmp_path,
    )
    assert meta.current_version == 2
    assert store.read_code("script_001", 1, tmp_path) == v1
    assert "image + 1" in store.read_code("script_001", 2, tmp_path)


def test_rejects_empty_name_and_bad_code(tmp_path) -> None:
    with pytest.raises(ValueError, match="name"):
        store.create_script("  ", "def process(image, seed=0):\n    return image\n", tmp_path)
    with pytest.raises(ValueError, match="process"):
        store.create_script("X", "x = 1\n", tmp_path)
    with pytest.raises(ValueError, match="syntax"):
        store.create_script("X", "def process(\n", tmp_path)


def test_list_scripts(tmp_path) -> None:
    store.create_script("A", "def process(image, seed=0):\n    return image\n", tmp_path)
    store.create_script("B", "def process(image, seed=0):\n    return image\n", tmp_path)
    items = store.list_scripts(tmp_path)
    assert [item.id for item in items] == ["script_001", "script_002"]
