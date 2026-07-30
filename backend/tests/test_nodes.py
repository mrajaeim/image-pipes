"""Smoke tests for built-in OpenCV nodes."""

from __future__ import annotations

import numpy as np

from app.engine.registry import registry
from app.nodes import register_builtin_nodes


def test_builtin_nodes_registered() -> None:
    register_builtin_nodes()
    expected = {
        "load_image",
        "save_image",
        "preview",
        "to_gray",
        "to_hsv",
        "split_channels",
        "merge_channels",
        "gaussian_blur",
        "median_blur",
        "canny",
        "threshold",
        "erode",
        "dilate",
        "morphology_ex",
        "resize",
        "rotate",
        "crop",
        "flip",
        "random_brightness_contrast",
        "gaussian_noise",
    }
    types = {meta.type for meta in registry.list_metadata()}
    assert expected.issubset(types)


def test_filter_pipeline_deterministic(tmp_path) -> None:
    register_builtin_nodes()
    image = np.zeros((32, 32, 3), dtype=np.uint8)
    image[8:24, 8:24] = (40, 80, 120)
    path = tmp_path / "in.png"
    import cv2

    cv2.imwrite(str(path), image)

    loaded = registry.get("load_image").execute({}, {"path": str(path)}, seed=0)["image"]
    assert isinstance(loaded, list)
    blurred = registry.get("gaussian_blur").execute(
        {"image": loaded[0]},
        {"ksize": 3, "sigma": 0},
        seed=0,
    )["image"]
    gray = registry.get("to_gray").execute({"image": blurred}, {}, seed=0)["image"]
    assert isinstance(gray, np.ndarray)
    assert gray.ndim == 2

    noisy_a = registry.get("gaussian_noise").execute(
        {"image": gray},
        {"mean": 0, "stddev": 5},
        seed=7,
    )["image"]
    noisy_b = registry.get("gaussian_noise").execute(
        {"image": gray},
        {"mean": 0, "stddev": 5},
        seed=7,
    )["image"]
    assert np.array_equal(noisy_a, noisy_b)
