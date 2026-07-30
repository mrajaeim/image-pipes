"""Starter node that emits bbox / keypoint annotation payloads."""

from __future__ import annotations

import json
from typing import Any

from app.engine.registry import BaseNode
from app.nodes.common import bboxes_out, keypoints_out, string_param


def _parse_json_list(raw: Any, *, label: str) -> list[Any]:
    if raw is None or raw == "":
        return []
    if isinstance(raw, list):
        return raw
    if not isinstance(raw, str):
        raise ValueError(f"{label} must be a JSON array string")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON for {label}: {exc}") from exc
    if not isinstance(parsed, list):
        raise ValueError(f"{label} JSON must be an array")
    return parsed


def _validate_bboxes(items: list[Any]) -> list[list[Any]]:
    result: list[list[Any]] = []
    for item in items:
        if not isinstance(item, (list, tuple)) or len(item) < 4:
            raise ValueError(
                "Each bbox must be [x_min, y_min, x_max, y_max, label?] (Pascal VOC)"
            )
        box = [
            float(item[0]),
            float(item[1]),
            float(item[2]),
            float(item[3]),
            str(item[4]) if len(item) >= 5 else "object",
        ]
        if box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError(f"Invalid bbox extents: {box[:4]}")
        result.append(box)
    return result


def _validate_keypoints(items: list[Any]) -> list[list[float]]:
    result: list[list[float]] = []
    for item in items:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            raise ValueError("Each keypoint must be [x, y]")
        result.append([float(item[0]), float(item[1])])
    return result


class AnnotationsNode(BaseNode):
    type = "annotations"
    label = "Annotations"
    category = "starters"
    description = (
        "Emit Pascal-VOC bboxes and xy keypoints for Albumentations dual ports."
    )
    ports = [bboxes_out(), keypoints_out()]
    params = [
        string_param(
            "bboxes_json",
            "BBoxes JSON",
            '[[10, 10, 100, 80, "object"]]',
            description='Pascal VOC array: [[x_min, y_min, x_max, y_max, label], ...]',
        ),
        string_param(
            "keypoints_json",
            "Keypoints JSON",
            "[[40, 40], [80, 60]]",
            description="XY keypoints array: [[x, y], ...]",
        ),
    ]
    cacheable = True
    stochastic = False

    def execute(
        self,
        inputs: dict[str, Any],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, Any]:
        del inputs, seed
        bboxes = _validate_bboxes(_parse_json_list(params.get("bboxes_json"), label="bboxes"))
        keypoints = _validate_keypoints(
            _parse_json_list(params.get("keypoints_json"), label="keypoints")
        )
        return {"bboxes": bboxes, "keypoints": keypoints}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        del node_id, input_vars
        bboxes = _validate_bboxes(_parse_json_list(params.get("bboxes_json"), label="bboxes"))
        keypoints = _validate_keypoints(
            _parse_json_list(params.get("keypoints_json"), label="keypoints")
        )
        lines: list[str] = []
        if "bboxes" in output_vars:
            lines.append(f"{output_vars['bboxes']} = {bboxes!r}")
        if "keypoints" in output_vars:
            lines.append(f"{output_vars['keypoints']} = {keypoints!r}")
        return lines or ["pass"]
