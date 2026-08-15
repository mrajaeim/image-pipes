"""Fixtures and sampling helpers for first-party node param coverage."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode, registry
from app.models.graph import NodeMetadata, ParamField, PortDirection
from app.nodes import register_builtin_nodes

SKIP_NODES: frozenset[str] = frozenset(
    {
        "load_image",  # needs asset / sample path setup
        "save_image",  # params affect disk write, not image port pixels
        "custom_python",  # freeform code string; covered by test_custom_python_node
    }
)

# (node_type, param_name) — skip sweeping this param (known no-op or fragile).
SKIP_PARAMS: frozenset[tuple[str, str]] = frozenset(
    {
        ("kmeans_colors", "attempts"),
        ("blur_detect", "threshold"),  # label flip needs score near threshold
        ("gaussian_blur", "sigma"),  # 0 means auto-from-ksize; tiny changes noop
        ("normalize", "beta"),  # unused for non-minmax; context locks minmax but beta=255 default
        ("sobel", "dx"),  # covered via dy/ksize/scale; dx=0 with dy=0 collapses to default
        # Retrieval mode often draws the same outer contour set on simple blobs.
        ("find_contours", "mode"),
    }
)

# Extra params merged into baseline when sweeping any field on the node.
PARAM_CONTEXT: dict[str, dict[str, Any]] = {
    "threshold": {"method": "binary"},
    "distance_transform": {"distance": "l2"},
    "normalize": {"norm_type": "minmax"},
    "in_range": {
        "space": "bgr",
        "c0_min": 0,
        "c0_max": 120,
        "c1_min": 0,
        "c1_max": 120,
        "c2_min": 0,
        "c2_max": 120,
    },
    "find_contours": {"overlay": "blank"},
    "convex_hull": {"overlay": "blank"},
    "moments": {"overlay": "blank"},
    "connected_components": {"overlay": "blank", "mode": "boxes", "min_area": 1},
    "blob_detect": {"overlay": "blank"},
    "bounding_rect": {"overlay": "blank"},
    "approx_poly": {"overlay": "blank"},
    "sobel": {"dx": "1", "dy": "0"},
    "blur_detect": {"output": "score_card"},
    "apply_mask": {"fill": "black"},
    "erode": {"ksize": 5, "iterations": 1},
    "dilate": {"ksize": 5, "iterations": 1},
    "morphology_ex": {"op": "gradient", "ksize": 5},
}

# Prefer odd values when sampling these integer params (OpenCV odd-kernel collapse).
ODD_KSIZE_PARAMS: frozenset[tuple[str, str]] = frozenset(
    {
        ("gaussian_blur", "ksize"),
        ("median_blur", "ksize"),
        ("sobel", "ksize"),
        ("laplacian", "ksize"),
        ("erode", "ksize"),
        ("dilate", "ksize"),
        ("morphology_ex", "ksize"),
        ("adaptive_threshold", "block_size"),
        ("blur_detect", "ksize"),
        ("box_blur", "ksize"),
    }
)

# Explicit numeric/select samples when min/default/max is insufficient.
PARAM_SAMPLES: dict[tuple[str, str], list[Any]] = {
    ("rotate", "angle"): [0.0, 90.0, -45.0],
    ("crop", "x"): [0, 8, 16],
    ("crop", "y"): [0, 8, 16],
    ("crop", "width"): [16, 32, 48],
    ("crop", "height"): [16, 32, 48],
    ("blank_image", "width"): [32, 64, 128],
    ("blank_image", "height"): [32, 64, 128],
    ("gaussian_noise", "stddev"): [0.0, 10.0, 50.0],
    ("gaussian_noise", "mean"): [0.0, 20.0, -20.0],
    ("random_brightness_contrast", "brightness"): [0.0, 30.0, 80.0],
    ("random_brightness_contrast", "contrast"): [0.0, 0.2, 0.8],
    ("brightness_contrast", "alpha"): [0.5, 1.0, 2.0],
    ("brightness_contrast", "beta"): [-50.0, 0.0, 50.0],
    ("normalize", "alpha"): [0.0, 50.0],
    ("normalize", "beta"): [200.0, 255.0],
    ("threshold", "thresh"): [50.0, 127.0, 200.0],
    ("threshold", "maxval"): [128.0, 255.0],
    ("canny", "threshold1"): [10.0, 100.0, 250.0],
    ("canny", "threshold2"): [50.0, 200.0, 400.0],
    # Keep min_area <= default max_area (5000) and max_area >= default min_area (20).
    ("blob_detect", "min_area"): [1.0, 20.0, 2000.0],
    ("blob_detect", "max_area"): [100.0, 5000.0, 50000.0],
    ("annotations", "bboxes_json"): [
        '[[10, 10, 100, 80, "object"]]',
        '[[5, 5, 40, 40, "a"], [50, 50, 90, 90, "b"]]',
    ],
    ("annotations", "keypoints_json"): [
        "[[40, 40], [80, 60]]",
        "[[10, 10]]",
        "[]",
    ],
}

# Nodes that need a soft-edged / multi-tone image (not pure 0/255 blobs).
TONAL_NODES: frozenset[str] = frozenset(
    {
        "threshold",
        "adaptive_threshold",
        "canny",
        "sobel",
        "laplacian",
        "blur_detect",
        "clahe",
        "normalize",
        "draw_histogram",
        "compare_hist",
        "in_range",
        "bilateral_filter",
        "gaussian_blur",
        "median_blur",
        "box_blur",
        "sharpen",
        "brightness_contrast",
        "random_brightness_contrast",
        "gaussian_noise",
        "kmeans_colors",
        "dominant_colors_hist",
    }
)

STRUCTURE_NODES: frozenset[str] = frozenset(
    {
        "find_contours",
        "convex_hull",
        "moments",
        "connected_components",
        "blob_detect",
        "bounding_rect",
        "approx_poly",
        "distance_transform",
        "erode",
        "dilate",
        "morphology_ex",
    }
)


def ensure_registry() -> None:
    register_builtin_nodes()


def first_party_param_metadata() -> list[NodeMetadata]:
    ensure_registry()
    return [
        m
        for m in registry.list_metadata()
        if not m.type.startswith("albu_")
        and not m.type.startswith("user_script.")
        and m.params
    ]


def textured_bgr(size: int = 64) -> np.ndarray:
    """Gradient + bright rectangle — not flat zeros."""
    yy, xx = np.mgrid[0:size, 0:size]
    image = np.zeros((size, size, 3), dtype=np.uint8)
    image[:, :, 0] = (xx * 3).astype(np.uint8)
    image[:, :, 1] = (yy * 3).astype(np.uint8)
    image[:, :, 2] = ((xx + yy) * 2).astype(np.uint8)
    lo, hi = size // 4, 3 * size // 4
    image[lo:hi, lo:hi] = (40, 180, 220)
    # Extra smaller blob for multi-component structure nodes.
    image[4:14, 4:14] = (20, 220, 40)
    return image


def textured_gray(size: int = 64) -> np.ndarray:
    return cv2.cvtColor(textured_bgr(size), cv2.COLOR_BGR2GRAY)


def binary_blob(size: int = 64) -> np.ndarray:
    """Axis-aligned blobs that only touch at a corner (4- vs 8-connectivity differs)."""
    image = np.zeros((size, size), dtype=np.uint8)
    image[10:20, 10:20] = 255
    image[20:30, 20:30] = 255
    image[6:16, 40:50] = 255
    return image


def rotated_blob(size: int = 64) -> np.ndarray:
    """Filled rotated ellipse so axis vs rotated bounding rects differ."""
    image = np.zeros((size, size), dtype=np.uint8)
    center = (size // 2, size // 2)
    axes = (size // 3, size // 8)
    cv2.ellipse(image, center, axes, 35, 0, 360, 255, thickness=-1)
    return image


def soft_edges_gray(size: int = 64) -> np.ndarray:
    """Blurred blob — soft thresholds respond to thresh params."""
    image = np.zeros((size, size), dtype=np.uint8)
    lo, hi = size // 4, 3 * size // 4
    image[lo:hi, lo:hi] = 255
    image = cv2.GaussianBlur(image.astype(np.float32), (9, 9), 2.0)
    return np.clip(image, 0, 255).astype(np.uint8)


def morph_blob(size: int = 64) -> np.ndarray:
    """Circular blob so morph kernel shapes (rect/ellipse/cross) diverge."""
    image = np.zeros((size, size), dtype=np.uint8)
    cv2.circle(image, (size // 2, size // 2), size // 3, 255, thickness=-1)
    return image


def partial_mask(size: int = 64) -> np.ndarray:
    mask = np.zeros((size, size), dtype=np.uint8)
    mask[:, : size // 2] = 255
    return mask


def build_inputs(meta: NodeMetadata) -> dict[str, Any]:
    """Build execute() inputs for a node's required (and useful optional) ports."""
    required = [
        p
        for p in meta.ports
        if p.direction == PortDirection.INPUT and not p.optional
    ]
    optional = [
        p for p in meta.ports if p.direction == PortDirection.INPUT and p.optional
    ]
    ids = {p.id for p in required}

    if meta.type == "blank_image":
        return {}
    if meta.type == "annotations":
        return {}
    if meta.type == "apply_mask":
        return {"image": textured_bgr(), "mask": partial_mask()}
    if ids == {"a", "b"} or ids == {"a", "b", "mask"}:
        a = textured_bgr()
        b = textured_bgr()
        b = cv2.rotate(b, cv2.ROTATE_180)
        inputs: dict[str, Any] = {"a": a, "b": b}
        if "mask" in ids or any(p.id == "mask" for p in optional):
            inputs["mask"] = None
        return inputs
    if ids == {"image_a", "image_b"}:
        a = textured_bgr()
        b = np.full_like(a, 80)
        b[16:48, 16:48] = (200, 40, 40)
        return {"image_a": a, "image_b": b}
    if "image" in ids:
        if meta.type == "bounding_rect":
            return {"image": rotated_blob()}
        if meta.type == "canny":
            return {"image": textured_gray()}
        if meta.type in {"threshold", "adaptive_threshold", "distance_transform"}:
            return {"image": soft_edges_gray()}
        if meta.type in {"erode", "dilate", "morphology_ex"}:
            return {"image": morph_blob()}
        if meta.type in STRUCTURE_NODES:
            return {"image": binary_blob()}
        if meta.type in TONAL_NODES:
            return {"image": textured_bgr()}
        return {"image": textured_bgr()}
    return {}


def _coerce_odd(value: int) -> int:
    value = int(value)
    if value % 2 == 0:
        value += 1
    return max(1, value)


def sample_values(node_type: str, field: ParamField) -> list[Any]:
    key = (node_type, field.name)
    if key in PARAM_SAMPLES:
        return list(PARAM_SAMPLES[key])

    if field.type == "select" and field.options:
        return list(field.options)

    if field.type in {"integer", "number"}:
        values: list[Any] = []
        for candidate in (field.minimum, field.default, field.maximum):
            if candidate is None:
                continue
            values.append(int(candidate) if field.type == "integer" else float(candidate))
        if key in ODD_KSIZE_PARAMS:
            values = [_coerce_odd(int(v)) for v in values]
        # Deduplicate while preserving order.
        seen: set[Any] = set()
        unique: list[Any] = []
        for v in values:
            if v not in seen:
                seen.add(v)
                unique.append(v)
        return unique

    # string / file — only via PARAM_SAMPLES
    return []


def baseline_params(node: BaseNode, meta: NodeMetadata) -> dict[str, Any]:
    context = dict(PARAM_CONTEXT.get(meta.type, {}))
    return node.validate_params(context)


def primary_output(result: dict[str, Any], meta: NodeMetadata) -> Any:
    if meta.type == "annotations":
        return (result.get("bboxes"), result.get("keypoints"))
    if "image" in result:
        return result["image"]
    for port in meta.ports:
        if port.direction == PortDirection.OUTPUT and port.id in result:
            return result[port.id]
    raise KeyError(f"No primary output for node {meta.type}: {list(result)}")


def outputs_equal(a: Any, b: Any) -> bool:
    if isinstance(a, np.ndarray) and isinstance(b, np.ndarray):
        return a.shape == b.shape and np.array_equal(a, b)
    if isinstance(a, tuple) and isinstance(b, tuple):
        return all(outputs_equal(x, y) for x, y in zip(a, b, strict=True))
    return a == b


def param_cases() -> list[tuple[str, str]]:
    """(node_type, param_name) pairs the harness should cover."""
    cases: list[tuple[str, str]] = []
    for meta in first_party_param_metadata():
        if meta.type in SKIP_NODES:
            continue
        node = registry.get(meta.type)
        for field in meta.params:
            if (meta.type, field.name) in SKIP_PARAMS:
                continue
            samples = sample_values(meta.type, field)
            if not samples:
                continue
            # Need at least one sample that can differ from baseline value.
            baseline = baseline_params(node, meta)
            if all(s == baseline.get(field.name) for s in samples):
                continue
            cases.append((meta.type, field.name))
    return cases
