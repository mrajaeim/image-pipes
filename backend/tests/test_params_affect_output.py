"""Registry-driven tests: first-party node params must affect execute() output."""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.engine.registry import registry
from app.nodes import register_builtin_nodes
from tests.helpers.node_fixtures import (
    SKIP_NODES,
    baseline_params,
    build_inputs,
    ensure_registry,
    first_party_param_metadata,
    outputs_equal,
    param_cases,
    primary_output,
    sample_values,
    textured_gray,
)


@pytest.fixture(scope="module", autouse=True)
def _register_nodes() -> None:
    ensure_registry()


@pytest.mark.parametrize(("node_type", "param_name"), param_cases())
def test_param_affects_output(node_type: str, param_name: str) -> None:
    meta = next(m for m in registry.list_metadata() if m.type == node_type)
    node = registry.get(node_type)
    field = next(f for f in meta.params if f.name == param_name)
    inputs = build_inputs(meta)
    base_params = baseline_params(node, meta)
    baseline = primary_output(node.execute(inputs, base_params, seed=0), meta)

    differed = False
    last_error: Exception | None = None
    for value in sample_values(node_type, field):
        if value == base_params.get(param_name):
            continue
        mutated = dict(base_params)
        mutated[param_name] = value
        try:
            params = node.validate_params(mutated)
            result = primary_output(node.execute(inputs, params, seed=0), meta)
        except Exception as exc:  # noqa: BLE001 — collect and continue other samples
            last_error = exc
            continue
        if not outputs_equal(baseline, result):
            differed = True
            break

    if not differed and last_error is not None:
        raise AssertionError(
            f"{node_type}.{param_name}: no differing sample; last error: {last_error}"
        ) from last_error
    assert differed, (
        f"{node_type}.{param_name}: changing among {sample_values(node_type, field)!r} "
        f"did not change output vs baseline {base_params.get(param_name)!r}"
    )


def test_every_first_party_param_node_is_accounted_for() -> None:
    covered_nodes = {node_type for node_type, _ in param_cases()}
    missing: list[str] = []
    for meta in first_party_param_metadata():
        if meta.type in SKIP_NODES:
            continue
        if meta.type in covered_nodes:
            continue
        # Node must either generate cases or be explicitly skipped.
        missing.append(meta.type)
    assert not missing, (
        "First-party param nodes with no harness coverage and not in SKIP_NODES: "
        f"{missing}"
    )


def test_threshold_binary_inv_matches_opencv() -> None:
    register_builtin_nodes()
    image = textured_gray(32)
    thresh, maxval = 127.0, 255.0
    node = registry.get("threshold")
    binary = node.execute(
        {"image": image},
        node.validate_params({"method": "binary", "thresh": thresh, "maxval": maxval}),
        seed=0,
    )["image"]
    binary_inv = node.execute(
        {"image": image},
        node.validate_params(
            {"method": "binary_inv", "thresh": thresh, "maxval": maxval}
        ),
        seed=0,
    )["image"]
    _, expected_inv = cv2.threshold(image, thresh, maxval, cv2.THRESH_BINARY_INV)
    assert not np.array_equal(binary, binary_inv)
    assert np.array_equal(binary_inv, expected_inv)


@pytest.mark.parametrize(
    "method",
    [
        "binary",
        "binary_inv",
        "trunc",
        "tozero",
        "tozero_inv",
        "otsu",
        "otsu_inv",
        "triangle",
        "triangle_inv",
    ],
)
def test_threshold_method_matches_opencv_flag(method: str) -> None:
    register_builtin_nodes()
    image = textured_gray(48)
    params = registry.get("threshold").validate_params(
        {"method": method, "thresh": 100.0, "maxval": 255.0}
    )
    result = registry.get("threshold").execute({"image": image}, params, seed=0)["image"]

    flags: dict[str, int] = {
        "binary": cv2.THRESH_BINARY,
        "binary_inv": cv2.THRESH_BINARY_INV,
        "trunc": cv2.THRESH_TRUNC,
        "tozero": cv2.THRESH_TOZERO,
        "tozero_inv": cv2.THRESH_TOZERO_INV,
        "otsu": cv2.THRESH_BINARY | cv2.THRESH_OTSU,
        "otsu_inv": cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU,
        "triangle": cv2.THRESH_BINARY | cv2.THRESH_TRIANGLE,
        "triangle_inv": cv2.THRESH_BINARY_INV | cv2.THRESH_TRIANGLE,
    }
    _, expected = cv2.threshold(
        image, float(params["thresh"]), float(params["maxval"]), flags[method]
    )
    assert np.array_equal(result, expected)
