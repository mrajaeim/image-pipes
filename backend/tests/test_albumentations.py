"""Tests for Albumentations multi-target augment nodes."""

from __future__ import annotations

import numpy as np

from app.engine.cache import CacheManager
from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.models.graph import Edge, ExecuteRequest, Graph, NodeInstance
from app.nodes import register_builtin_nodes


def _image() -> np.ndarray:
    image = np.full((64, 64, 3), 90, dtype=np.uint8)
    image[8:40, 8:40] = (30, 180, 70)
    return image


def test_augment_nodes_registered() -> None:
    register_builtin_nodes()
    augment = [meta for meta in registry.list_metadata() if meta.category == "augment"]
    assert len(augment) >= 50
    assert registry.has("albu_horizontal_flip")
    assert registry.has("albu_random_brightness_contrast")
    assert registry.has("annotations")


def test_image_only_passthrough_annotations() -> None:
    register_builtin_nodes()
    node = registry.get("albu_random_brightness_contrast")
    params = node.validate_params({"p": 1.0, "brightness_limit": 0.1, "contrast_limit": 0.1})
    bboxes = [[8, 8, 40, 40, "car"]]
    keypoints = [[20.0, 20.0]]
    mask = np.zeros((64, 64), dtype=np.uint8)
    mask[8:40, 8:40] = 255
    out = node.execute(
        {"image": _image(), "mask": mask, "bboxes": bboxes, "keypoints": keypoints},
        params,
        seed=3,
    )
    assert out["image"].shape == (64, 64, 3)
    assert out["bboxes"] == bboxes
    assert out["keypoints"] == keypoints
    assert out["mask"].shape[:2] == (64, 64)


def test_dual_flip_updates_bboxes_and_keypoints() -> None:
    register_builtin_nodes()
    node = registry.get("albu_horizontal_flip")
    params = node.validate_params({"p": 1.0})
    out = node.execute(
        {
            "image": _image(),
            "bboxes": [[8, 8, 40, 40, "car"]],
            "keypoints": [[20.0, 12.0]],
        },
        params,
        seed=0,
    )
    # x mirrored in 64-wide image: x' = W - x
    assert out["bboxes"][0][0] == 24.0
    assert out["bboxes"][0][2] == 56.0
    assert out["bboxes"][0][4] == "car"
    assert out["keypoints"][0][0] == 43.0
    assert out["keypoints"][0][1] == 12.0


def test_seed_reproducibility() -> None:
    register_builtin_nodes()
    node = registry.get("albu_gauss_noise")
    params = node.validate_params({"p": 1.0})
    a = node.execute({"image": _image()}, params, seed=11)["image"]
    b = node.execute({"image": _image()}, params, seed=11)["image"]
    c = node.execute({"image": _image()}, params, seed=12)["image"]
    assert np.array_equal(a, b)
    assert not np.array_equal(a, c)


def test_optional_ports_omitted() -> None:
    register_builtin_nodes()
    node = registry.get("albu_gaussian_blur")
    params = node.validate_params({"p": 1.0, "blur_limit": 5})
    out = node.execute({"image": _image()}, params, seed=0)
    assert set(out.keys()) == {"image"}


def test_annotations_node_and_pipeline(tmp_path) -> None:
    register_builtin_nodes()
    ann = registry.get("annotations")
    payload = ann.execute(
        {},
        ann.validate_params(
            {
                "bboxes_json": '[[5, 5, 30, 30, "a"]]',
                "keypoints_json": "[[10, 12]]",
            }
        ),
        seed=0,
    )
    assert payload["bboxes"][0][4] == "a"
    assert payload["keypoints"] == [[10.0, 12.0]]

    # Cache mixed ports from a dual node.
    flip = registry.get("albu_horizontal_flip")
    produced = flip.execute(
        {"image": _image(), "bboxes": payload["bboxes"], "keypoints": payload["keypoints"]},
        flip.validate_params({"p": 1.0}),
        seed=0,
    )
    cache = CacheManager(tmp_path / "cache")
    key = cache.make_key(
        "albu_horizontal_flip",
        {"p": 1.0},
        {port: cache.hash_value(value) for port, value in produced.items()},
        seed=0,
    )
    cache.put_outputs(key, produced)
    loaded = cache.get_outputs(key)
    assert loaded is not None
    assert loaded["bboxes"] == produced["bboxes"]
    assert np.array_equal(loaded["image"], produced["image"])


def test_executor_runs_annotations_to_flip(tmp_path) -> None:
    register_builtin_nodes()
    image_path = tmp_path / "in.png"
    import cv2

    cv2.imwrite(str(image_path), _image())
    request = ExecuteRequest(
        graph=Graph(
            nodes=[
                NodeInstance(
                    id="load",
                    type="load_image",
                    params={"path": str(image_path)},
                ),
                NodeInstance(
                    id="ann",
                    type="annotations",
                    params={
                        "bboxes_json": "[[8, 8, 40, 40, \"car\"]]",
                        "keypoints_json": "[[20, 20]]",
                    },
                ),
                NodeInstance(id="flip", type="albu_horizontal_flip", params={"p": 1.0}),
            ],
            edges=[
                Edge(
                    id="e1",
                    source="load",
                    source_port="image",
                    target="flip",
                    target_port="image",
                ),
                Edge(
                    id="e2",
                    source="ann",
                    source_port="bboxes",
                    target="flip",
                    target_port="bboxes",
                ),
                Edge(
                    id="e3",
                    source="ann",
                    source_port="keypoints",
                    target="flip",
                    target_port="keypoints",
                ),
            ],
        ),
        seed=0,
        cache=True,
    )
    events: list[dict] = []
    executor = DagExecutor(tmp_path / "cache", node_registry=registry)
    result = executor.execute(
        request,
        on_event=lambda event: events.append(event.model_dump())
        if event.type.value == "preview"
        else None,
    )
    assert "flip" in result["order"]
    flip_previews = [
        event
        for event in events
        if event.get("node_id") == "flip" and event.get("port_id") == "image"
    ]
    assert flip_previews
    assert flip_previews[0].get("data") is not None
    assert "bboxes" in flip_previews[0]["data"]
