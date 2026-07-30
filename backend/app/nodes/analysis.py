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


def _as_hist_image(image: np.ndarray) -> np.ndarray:
    """Ensure uint8 image suitable for cv2.calcHist ranges [0, 256)."""
    if image.dtype == np.uint8:
        return image
    if np.issubdtype(image.dtype, np.floating):
        finite = np.nan_to_num(image, nan=0.0, posinf=0.0, neginf=0.0)
        max_val = float(finite.max()) if finite.size else 0.0
        if max_val <= 1.0:
            finite = finite * 255.0
        return np.clip(finite, 0, 255).astype(np.uint8)
    info = np.iinfo(image.dtype) if np.issubdtype(image.dtype, np.integer) else None
    if info is not None and info.max > 255:
        scaled = image.astype(np.float32) * (255.0 / float(info.max))
        return np.clip(scaled, 0, 255).astype(np.uint8)
    return np.clip(image, 0, 255).astype(np.uint8)


def _draw_hist_bars(
    canvas: np.ndarray,
    hist: np.ndarray,
    color: tuple[int, int, int],
    *,
    filled: bool = True,
) -> None:
    height, width = canvas.shape[:2]
    values = np.asarray(hist, dtype=np.float64).reshape(-1)
    if values.size == 0:
        return
    peak = float(values.max())
    if peak <= 0:
        return
    scale = (height - 1) / peak
    bin_w = max(1, int(width / max(1, values.size)))
    for i, raw in enumerate(values):
        bar_h = int(float(raw) * scale)
        if bar_h <= 0:
            continue
        x1 = int(i * width / values.size)
        x2 = min(width - 1, x1 + bin_w)
        y1 = height - 1 - bar_h
        y2 = height - 1
        if filled:
            cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness=-1)
        else:
            cv2.line(canvas, (x1, y2), (x1, y1), color, 2, cv2.LINE_AA)


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
        image = _as_hist_image(require_image(inputs))
        height = int(params["height"])
        width = int(params["width"])
        canvas = np.full((height, width, 3), 24, dtype=np.uint8)
        # Subtle grid so empty-looking previews are still readable when scaled down.
        for frac in (0.25, 0.5, 0.75):
            y = int(height * (1.0 - frac))
            cv2.line(canvas, (0, y), (width - 1, y), (40, 40, 40), 1)

        mode = str(params["mode"])
        if mode == "gray" or len(image.shape) == 2:
            gray = image if len(image.shape) == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
            _draw_hist_bars(canvas, hist, (230, 230, 230))
        else:
            if image.shape[2] == 4:
                image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
            # Draw B, G, R with alpha-like stacking via lighter overdraw.
            colors = ((255, 90, 90), (90, 220, 90), (90, 90, 255))
            for channel_idx, color in enumerate(colors):
                hist = cv2.calcHist([image], [channel_idx], None, [256], [0, 256]).ravel()
                _draw_hist_bars(canvas, hist, color)
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
        mode = str(params["mode"])
        lines = [
            f"{dst} = np.full(({height}, {width}, 3), 24, dtype='uint8')",
        ]
        if mode == "gray":
            lines.extend(
                [
                    (
                        f"_gray = {src} if len({src}.shape) == 2 else "
                        f"cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)"
                    ),
                    "_hist = cv2.calcHist([_gray], [0], None, [256], [0, 256]).ravel()",
                    f"_scale = ({height} - 1) / max(float(_hist.max()), 1.0)",
                    "for _i, _v in enumerate(_hist):",
                    "    _h = int(float(_v) * _scale)",
                    "    if _h <= 0: continue",
                    f"    _x1 = int(_i * {width} / 256)",
                    f"    _x2 = min({width} - 1, _x1 + max(1, {width} // 256))",
                    f"    cv2.rectangle({dst}, (_x1, {height} - 1 - _h), (_x2, {height} - 1), "
                    "(230, 230, 230), -1)",
                ]
            )
        else:
            lines.extend(
                [
                    f"_img = {src}",
                    "if len(_img.shape) == 2: _img = cv2.cvtColor(_img, cv2.COLOR_GRAY2BGR)",
                    "_colors = [(255, 90, 90), (90, 220, 90), (90, 90, 255)]",
                    "for _c, _color in enumerate(_colors):",
                    "    _hist = cv2.calcHist([_img], [_c], None, [256], [0, 256]).ravel()",
                    f"    _scale = ({height} - 1) / max(float(_hist.max()), 1.0)",
                    "    for _i, _v in enumerate(_hist):",
                    "        _h = int(float(_v) * _scale)",
                    "        if _h <= 0: continue",
                    f"        _x1 = int(_i * {width} / 256)",
                    f"        _x2 = min({width} - 1, _x1 + max(1, {width} // 256))",
                    f"        cv2.rectangle({dst}, (_x1, {height} - 1 - _h), (_x2, {height} - 1), "
                    "_color, -1)",
                ]
            )
        return lines


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


class BlurDetectNode(BaseNode):
    type = "blur_detect"
    label = "Blur Detect"
    category = "analysis"
    description = "Estimate blur / focus via Laplacian variance (autofocus score)."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 3, minimum=1, maximum=31),
        number_param(
            "threshold",
            "Blur Threshold",
            100.0,
            minimum=0.0,
            maximum=5000.0,
            description="Scores below this are labeled blurry.",
        ),
        select_param("output", "Output", "overlay", ["overlay", "score_card"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        gray = _as_gray(image)
        ksize = int(params["ksize"])
        if ksize % 2 == 0:
            ksize += 1
        ksize = max(1, ksize)
        lap = cv2.Laplacian(gray, cv2.CV_64F, ksize=ksize)
        score = float(lap.var())
        threshold = float(params["threshold"])
        label = "sharp" if score >= threshold else "blurry"
        text = f"focus={score:.1f} ({label})"
        if str(params["output"]) == "score_card":
            canvas = np.full((120, 420, 3), 28, dtype=np.uint8)
            color = (80, 220, 120) if label == "sharp" else (80, 80, 255)
            cv2.putText(
                canvas,
                text,
                (16, 70),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                color,
                2,
                cv2.LINE_AA,
            )
            return {"image": canvas}
        if len(image.shape) == 2:
            canvas = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        elif image.shape[2] == 4:
            canvas = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
        else:
            canvas = image.copy()
        color = (80, 220, 120) if label == "sharp" else (80, 80, 255)
        cv2.rectangle(canvas, (8, 8), (min(canvas.shape[1] - 8, 360), 42), (0, 0, 0), -1)
        cv2.putText(
            canvas,
            text,
            (14, 34),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
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
        src = input_vars["image"]
        dst = output_vars["image"]
        ksize = int(params["ksize"])
        if ksize % 2 == 0:
            ksize += 1
        return [
            f"_gray = {src} if len({src}.shape)==2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            f"_score = float(cv2.Laplacian(_gray, cv2.CV_64F, ksize={ksize}).var())",
            (
                f"{dst} = {src}.copy() if len({src}.shape)==3 else "
                f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
            ),
            f"cv2.putText({dst}, f'focus={{_score:.1f}}', (14, 34), "
            "cv2.FONT_HERSHEY_SIMPLEX, 0.7, (80, 220, 120), 2, cv2.LINE_AA)",
        ]
