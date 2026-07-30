"""Color clustering and dominant-color analysis nodes."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, int_param, require_image, select_param


def _as_bgr(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image.copy()


def _palette_strip(colors: np.ndarray, width: int, height: int) -> np.ndarray:
    strip = np.zeros((height, width, 3), dtype=np.uint8)
    n = max(1, len(colors))
    seg = width // n
    for i, color in enumerate(colors):
        x0 = i * seg
        x1 = width if i == n - 1 else (i + 1) * seg
        strip[:, x0:x1] = color.astype(np.uint8)
    return strip


class KMeansColorsNode(BaseNode):
    type = "kmeans_colors"
    label = "K-Means Colors"
    category = "analysis"
    description = "Cluster pixels with k-means to find dominant colors / quantize."
    ports = [image_in(), image_out()]
    params = [
        int_param("k", "Clusters (K)", 5, minimum=2, maximum=16),
        int_param("attempts", "Attempts", 3, minimum=1, maximum=10),
        select_param("output", "Output", "quantized", ["quantized", "palette", "both"]),
        int_param("palette_height", "Palette Height", 48, minimum=16, maximum=200),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = _as_bgr(require_image(inputs))
        k = int(params["k"])
        samples = image.reshape(-1, 3).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 1.0)
        _compactness, labels, centers = cv2.kmeans(
            samples,
            k,
            None,
            criteria,
            int(params["attempts"]),
            cv2.KMEANS_PP_CENTERS,
        )
        centers_u8 = np.clip(centers, 0, 255).astype(np.uint8)
        # Sort clusters by frequency for nicer palette visualization.
        counts = np.bincount(labels.flatten(), minlength=k)
        order = np.argsort(-counts)
        centers_sorted = centers_u8[order]
        quantized = centers_u8[labels.flatten()].reshape(image.shape)
        mode = str(params["output"])
        if mode == "palette":
            return {
                "image": _palette_strip(
                    centers_sorted,
                    image.shape[1],
                    int(params["palette_height"]),
                )
            }
        if mode == "both":
            strip = _palette_strip(
                centers_sorted,
                image.shape[1],
                int(params["palette_height"]),
            )
            return {"image": np.vstack([quantized, strip])}
        return {"image": quantized}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        k = int(params["k"])
        attempts = int(params["attempts"])
        return [
            f"_img = {src} if len({src}.shape)==3 else cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)",
            "_samples = _img.reshape(-1, 3).astype('float32')",
            "_crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 1.0)",
            f"_, _lab, _cen = cv2.kmeans(_samples, {k}, None, _crit, {attempts}, "
            "cv2.KMEANS_PP_CENTERS)",
            "_cen = np.clip(_cen, 0, 255).astype('uint8')",
            f"{dst} = _cen[_lab.flatten()].reshape(_img.shape)",
        ]


class DominantColorsHistNode(BaseNode):
    type = "dominant_colors_hist"
    label = "Dominant Colors (Hist)"
    category = "analysis"
    description = "Estimate dominant colors from a quantized RGB histogram."
    ports = [image_in(), image_out()]
    params = [
        int_param("bins", "Bins / Channel", 8, minimum=2, maximum=32),
        int_param("top_k", "Top Colors", 5, minimum=1, maximum=16),
        select_param("output", "Output", "palette", ["palette", "both"]),
        int_param("palette_height", "Palette Height", 48, minimum=16, maximum=200),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = _as_bgr(require_image(inputs))
        bins = int(params["bins"])
        top_k = int(params["top_k"])
        # Quantize each channel into `bins` levels.
        step = 256 / bins
        q = (image.astype(np.float32) // step).astype(np.int32)
        q = np.clip(q, 0, bins - 1)
        codes = q[:, :, 0] + q[:, :, 1] * bins + q[:, :, 2] * bins * bins
        flat = codes.flatten()
        counts = np.bincount(flat, minlength=bins**3)
        top_ids = np.argsort(-counts)[:top_k]
        colors = []
        for code in top_ids:
            if counts[code] <= 0:
                continue
            b = int((code % bins) * step + step / 2)
            g = int(((code // bins) % bins) * step + step / 2)
            r = int((code // (bins * bins)) * step + step / 2)
            colors.append(np.array([b, g, r], dtype=np.uint8))
        if not colors:
            colors = [np.array([0, 0, 0], dtype=np.uint8)]
        strip = _palette_strip(
            np.stack(colors, axis=0),
            image.shape[1],
            int(params["palette_height"]),
        )
        if str(params["output"]) == "both":
            return {"image": np.vstack([image, strip])}
        return {"image": strip}

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
            f"_img = {src} if len({src}.shape)==3 else cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)",
            f"# DominantColorsHistNode bins={int(params['bins'])} top_k={int(params['top_k'])}",
            f"{dst} = _img.copy()",
        ]
