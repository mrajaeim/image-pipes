"""Analysis nodes commonly used in imaging research pipelines."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import (
    image_in,
    image_out,
    int_param,
    number_param,
    require_image,
    select_param,
)


def _as_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


class AdaptiveThresholdNode(BaseNode):
    type = "adaptive_threshold"
    label = "Adaptive Threshold"
    category = "analysis"
    description = "Local adaptive binarization for uneven illumination."
    ports = [image_in(), image_out()]
    params = [
        number_param("maxval", "Max Value", 255.0, minimum=1.0, maximum=255.0),
        select_param("method", "Method", "gaussian", ["mean", "gaussian"]),
        select_param("type", "Threshold Type", "binary", ["binary", "binary_inv"]),
        int_param("block_size", "Block Size", 11, minimum=3, maximum=51),
        number_param("c", "C", 2.0, minimum=-20.0, maximum=20.0, step=0.5),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        gray = _as_gray(require_image(inputs))
        block = int(params["block_size"])
        if block % 2 == 0:
            block += 1
        block = max(3, block)
        method = (
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C
            if str(params["method"]) == "gaussian"
            else cv2.ADAPTIVE_THRESH_MEAN_C
        )
        thresh_type = (
            cv2.THRESH_BINARY_INV
            if str(params["type"]) == "binary_inv"
            else cv2.THRESH_BINARY
        )
        return {
            "image": cv2.adaptiveThreshold(
                gray,
                float(params["maxval"]),
                method,
                thresh_type,
                block,
                float(params["c"]),
            )
        }

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        block = int(params["block_size"])
        if block % 2 == 0:
            block += 1
        block = max(3, block)
        method = (
            "cv2.ADAPTIVE_THRESH_GAUSSIAN_C"
            if str(params["method"]) == "gaussian"
            else "cv2.ADAPTIVE_THRESH_MEAN_C"
        )
        thresh_type = (
            "cv2.THRESH_BINARY_INV"
            if str(params["type"]) == "binary_inv"
            else "cv2.THRESH_BINARY"
        )
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            (
                f"{dst} = cv2.adaptiveThreshold(_gray, {float(params['maxval'])}, "
                f"{method}, {thresh_type}, {block}, {float(params['c'])})"
            ),
        ]


class DistanceTransformNode(BaseNode):
    type = "distance_transform"
    label = "Distance Transform"
    category = "analysis"
    description = "Distance to nearest zero pixel — useful for medial axes / markers."
    ports = [image_in(), image_out()]
    params = [
        select_param("distance", "Distance", "l2", ["l1", "l2", "c"]),
        select_param("mask_size", "Mask Size", "5", ["3", "5"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        gray = _as_gray(require_image(inputs))
        # Distance transform expects zeros as background; keep as-is for research control.
        distance = {
            "l1": cv2.DIST_L1,
            "l2": cv2.DIST_L2,
            "c": cv2.DIST_C,
        }.get(str(params["distance"]), cv2.DIST_L2)
        mask = 5 if str(params["mask_size"]) == "5" else 3
        dist = cv2.distanceTransform(gray, distance, mask)
        normalized = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX)
        return {"image": normalized.astype(np.uint8)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        distance = {
            "l1": "cv2.DIST_L1",
            "l2": "cv2.DIST_L2",
            "c": "cv2.DIST_C",
        }.get(str(params["distance"]), "cv2.DIST_L2")
        mask = 5 if str(params["mask_size"]) == "5" else 3
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            f"_dist = cv2.distanceTransform(_gray, {distance}, {mask})",
            "_norm = cv2.normalize(_dist, None, 0, 255, cv2.NORM_MINMAX)",
            f"{dst} = _norm.astype('uint8')",
        ]


class HistogramEqualizeNode(BaseNode):
    type = "histogram_equalize"
    label = "Histogram Equalize"
    category = "analysis"
    description = "Global histogram equalization for contrast stretching."
    ports = [image_in(), image_out()]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        if len(image.shape) == 2:
            return {"image": cv2.equalizeHist(image)}
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        y_chan, cr, cb = cv2.split(ycrcb)
        merged = cv2.merge([cv2.equalizeHist(y_chan), cr, cb])
        return {"image": cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        return [
            f"if len({src}.shape) == 2:",
            f"    {dst} = cv2.equalizeHist({src})",
            "else:",
            f"    _ycc = cv2.cvtColor({src}, cv2.COLOR_BGR2YCrCb)",
            "    _y, _cr, _cb = cv2.split(_ycc)",
            "    _merged = cv2.merge([cv2.equalizeHist(_y), _cr, _cb])",
            f"    {dst} = cv2.cvtColor(_merged, cv2.COLOR_YCrCb2BGR)",
        ]
