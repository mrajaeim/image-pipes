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


def _draw_hist_curve(canvas: np.ndarray, hist: np.ndarray, color: tuple[int, int, int]) -> None:
    height, width = canvas.shape[:2]
    if hist.max() <= 0:
        return
    norm = hist * ((height - 1) / hist.max())
    bin_w = width / 256.0
    for i in range(1, 256):
        x1 = int((i - 1) * bin_w)
        x2 = int(i * bin_w)
        y1 = height - 1 - int(norm[i - 1])
        y2 = height - 1 - int(norm[i])
        cv2.line(canvas, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)


class DrawHistogramNode(BaseNode):
    type = "draw_histogram"
    label = "Draw Histogram"
    category = "analysis"
    description = "Render channel histograms as a plot image."
    ports = [image_in(), image_out()]
    params = [
        select_param("mode", "Mode", "channels", ["gray", "channels"]),
        int_param("height", "Plot Height", 256, minimum=64, maximum=1024),
        int_param("width", "Plot Width", 512, minimum=128, maximum=2048),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        height = int(params["height"])
        width = int(params["width"])
        canvas = np.full((height, width, 3), 30, dtype=np.uint8)
        if str(params["mode"]) == "gray" or len(image.shape) == 2:
            gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
            _draw_hist_curve(canvas, hist, (220, 220, 220))
        else:
            colors = ((255, 80, 80), (80, 255, 80), (80, 80, 255))  # B,G,R
            for channel_idx, color in enumerate(colors):
                hist = cv2.calcHist([image], [channel_idx], None, [256], [0, 256]).flatten()
                _draw_hist_curve(canvas, hist, color)
        return {"image": canvas}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        height = int(params["height"])
        width = int(params["width"])
        return [
            f"{dst} = np.full(({height}, {width}, 3), 30, dtype='uint8')",
            f"_h = cv2.calcHist([{src} if len({src}.shape)==2 else "
            f"cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)], [0], None, [256], [0, 256]).ravel()",
            f"_n = _h * (({height}-1) / max(float(_h.max()), 1.0))",
            f"_bw = {width} / 256.0",
            "for _i in range(1, 256):",
            "    _x1 = int((_i-1)*_bw); _x2 = int(_i*_bw)",
            f"    _y1 = {height}-1-int(_n[_i-1]); _y2 = {height}-1-int(_n[_i])",
            f"    cv2.line({dst}, (_x1, _y1), (_x2, _y2), (220, 220, 220), 1, cv2.LINE_AA)",
        ]


class NormalizeNode(BaseNode):
    type = "normalize"
    label = "Normalize"
    category = "analysis"
    description = "Normalize image intensities (cv2.normalize) for contrast / hist prep."
    ports = [image_in(), image_out()]
    params = [
        number_param("alpha", "Alpha", 0.0, minimum=0.0, maximum=255.0),
        number_param("beta", "Beta", 255.0, minimum=0.0, maximum=255.0),
        select_param("norm_type", "Norm Type", "minmax", ["minmax", "l2", "l1", "inf"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        norm_map = {
            "minmax": cv2.NORM_MINMAX,
            "l2": cv2.NORM_L2,
            "l1": cv2.NORM_L1,
            "inf": cv2.NORM_INF,
        }
        out = np.zeros_like(image, dtype=np.float32)
        cv2.normalize(
            image.astype(np.float32),
            out,
            float(params["alpha"]),
            float(params["beta"]),
            norm_map.get(str(params["norm_type"]), cv2.NORM_MINMAX),
        )
        return {"image": np.clip(out, 0, 255).astype(np.uint8)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        norm = {
            "minmax": "cv2.NORM_MINMAX",
            "l2": "cv2.NORM_L2",
            "l1": "cv2.NORM_L1",
            "inf": "cv2.NORM_INF",
        }.get(str(params["norm_type"]), "cv2.NORM_MINMAX")
        return [
            f"_o = np.zeros_like({src}, dtype='float32')",
            f"cv2.normalize({src}.astype('float32'), _o, {float(params['alpha'])}, "
            f"{float(params['beta'])}, {norm})",
            f"{dst} = np.clip(_o, 0, 255).astype('uint8')",
        ]


class CompareHistNode(BaseNode):
    type = "compare_hist"
    label = "Compare Histograms"
    category = "analysis"
    description = "Compare two images' histograms and overlay the similarity score."
    ports = [
        image_in("image_a", "Image A"),
        image_in("image_b", "Image B"),
        image_out(),
    ]
    params = [
        select_param(
            "method",
            "Method",
            "correlation",
            ["correlation", "chi_square", "intersection", "bhattacharyya"],
        ),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image_a = require_image(inputs, "image_a")
        image_b = require_image(inputs, "image_b")
        gray_a = _as_gray(image_a)
        gray_b = _as_gray(image_b)
        hist_a = cv2.calcHist([gray_a], [0], None, [256], [0, 256])
        hist_b = cv2.calcHist([gray_b], [0], None, [256], [0, 256])
        cv2.normalize(hist_a, hist_a, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(hist_b, hist_b, 0, 1, cv2.NORM_MINMAX)
        method_map = {
            "correlation": cv2.HISTCMP_CORREL,
            "chi_square": cv2.HISTCMP_CHISQR,
            "intersection": cv2.HISTCMP_INTERSECT,
            "bhattacharyya": cv2.HISTCMP_BHATTACHARYYA,
        }
        score = float(
            cv2.compareHist(
                hist_a,
                hist_b,
                method_map.get(str(params["method"]), cv2.HISTCMP_CORREL),
            )
        )
        canvas = np.full((160, 420, 3), 32, dtype=np.uint8)
        label = f"{params['method']}: {score:.4f}"
        cv2.putText(
            canvas,
            label,
            (20, 90),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (220, 220, 220),
            2,
            cv2.LINE_AA,
        )
        return {"image": canvas}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        a = input_vars["image_a"]
        b = input_vars["image_b"]
        dst = output_vars["image"]
        method = {
            "correlation": "cv2.HISTCMP_CORREL",
            "chi_square": "cv2.HISTCMP_CHISQR",
            "intersection": "cv2.HISTCMP_INTERSECT",
            "bhattacharyya": "cv2.HISTCMP_BHATTACHARYYA",
        }.get(str(params["method"]), "cv2.HISTCMP_CORREL")
        return [
            f"_ga = {a} if len({a}.shape)==2 else cv2.cvtColor({a}, cv2.COLOR_BGR2GRAY)",
            f"_gb = {b} if len({b}.shape)==2 else cv2.cvtColor({b}, cv2.COLOR_BGR2GRAY)",
            "_ha = cv2.calcHist([_ga], [0], None, [256], [0, 256])",
            "_hb = cv2.calcHist([_gb], [0], None, [256], [0, 256])",
            "cv2.normalize(_ha, _ha, 0, 1, cv2.NORM_MINMAX)",
            "cv2.normalize(_hb, _hb, 0, 1, cv2.NORM_MINMAX)",
            f"_score = float(cv2.compareHist(_ha, _hb, {method}))",
            f"{dst} = np.full((160, 420, 3), 32, dtype='uint8')",
            f"cv2.putText({dst}, f'{params['method']}: {{_score:.4f}}', (20, 90), "
            "cv2.FONT_HERSHEY_SIMPLEX, 0.8, (220, 220, 220), 2, cv2.LINE_AA)",
        ]
