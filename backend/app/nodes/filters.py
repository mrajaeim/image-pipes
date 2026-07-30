"""Filter and edge-detection nodes."""

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


def _odd(value: int) -> int:
    value = max(1, int(value))
    return value if value % 2 == 1 else value + 1


class GaussianBlurNode(BaseNode):
    type = "gaussian_blur"
    label = "Gaussian Blur"
    category = "filters"
    description = "Apply Gaussian blur."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 5, minimum=1, maximum=51),
        number_param("sigma", "Sigma", 0.0, minimum=0.0, maximum=20.0, step=0.1),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        ksize = _odd(int(params["ksize"]))
        sigma = float(params["sigma"])
        image = require_image(inputs)
        return {"image": cv2.GaussianBlur(image, (ksize, ksize), sigma)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        ksize = _odd(int(params["ksize"]))
        return [
            f"{output_vars['image']} = cv2.GaussianBlur("
            f"{input_vars['image']}, ({ksize}, {ksize}), {float(params['sigma'])})"
        ]


class MedianBlurNode(BaseNode):
    type = "median_blur"
    label = "Median Blur"
    category = "filters"
    description = "Apply median blur."
    ports = [image_in(), image_out()]
    params = [int_param("ksize", "Kernel Size", 5, minimum=1, maximum=51)]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        ksize = _odd(int(params["ksize"]))
        return {"image": cv2.medianBlur(require_image(inputs), ksize)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        ksize = _odd(int(params["ksize"]))
        return [f"{output_vars['image']} = cv2.medianBlur({input_vars['image']}, {ksize})"]


class CannyNode(BaseNode):
    type = "canny"
    label = "Canny Edges"
    category = "filters"
    description = "Canny edge detection."
    ports = [image_in(), image_out()]
    params = [
        number_param("threshold1", "Threshold 1", 100.0, minimum=0.0, maximum=500.0),
        number_param("threshold2", "Threshold 2", 200.0, minimum=0.0, maximum=500.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        if len(image.shape) == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(image, float(params["threshold1"]), float(params["threshold2"]))
        return {"image": edges}

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
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            (
                f"{dst} = cv2.Canny(_gray, {float(params['threshold1'])}, "
                f"{float(params['threshold2'])})"
            ),
        ]


def _threshold_flag(method: str) -> int:
    flags = {
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
    return flags.get(method, cv2.THRESH_BINARY)


def _threshold_flag_expr(method: str) -> str:
    exprs = {
        "binary": "cv2.THRESH_BINARY",
        "binary_inv": "cv2.THRESH_BINARY_INV",
        "trunc": "cv2.THRESH_TRUNC",
        "tozero": "cv2.THRESH_TOZERO",
        "tozero_inv": "cv2.THRESH_TOZERO_INV",
        "otsu": "cv2.THRESH_BINARY | cv2.THRESH_OTSU",
        "otsu_inv": "cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU",
        "triangle": "cv2.THRESH_BINARY | cv2.THRESH_TRIANGLE",
        "triangle_inv": "cv2.THRESH_BINARY_INV | cv2.THRESH_TRIANGLE",
    }
    return exprs.get(method, "cv2.THRESH_BINARY")


class ThresholdNode(BaseNode):
    type = "threshold"
    label = "Threshold"
    category = "filters"
    description = (
        "Global thresholding: binary, trunc, to-zero, Otsu, or Triangle methods."
    )
    ports = [image_in(), image_out()]
    params = [
        select_param(
            "method",
            "Method",
            "binary",
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
            description="Otsu/Triangle ignore the manual threshold and estimate it",
        ),
        number_param("thresh", "Threshold", 127.0, minimum=0.0, maximum=255.0),
        number_param("maxval", "Max Value", 255.0, minimum=0.0, maximum=255.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        if len(image.shape) == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        method = str(params.get("method", "binary"))
        _, result = cv2.threshold(
            image,
            float(params["thresh"]),
            float(params["maxval"]),
            _threshold_flag(method),
        )
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        method = str(params.get("method", "binary"))
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            f"_, {dst} = cv2.threshold(_gray, {float(params['thresh'])}, "
            f"{float(params['maxval'])}, {_threshold_flag_expr(method)})",
        ]


def _as_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


class BilateralFilterNode(BaseNode):
    type = "bilateral_filter"
    label = "Bilateral Filter"
    category = "filters"
    description = "Edge-preserving smoothing (useful before segmentation)."
    ports = [image_in(), image_out()]
    params = [
        int_param("d", "Diameter", 9, minimum=1, maximum=15),
        number_param("sigma_color", "Sigma Color", 75.0, minimum=1.0, maximum=200.0),
        number_param("sigma_space", "Sigma Space", 75.0, minimum=1.0, maximum=200.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        return {
            "image": cv2.bilateralFilter(
                image,
                int(params["d"]),
                float(params["sigma_color"]),
                float(params["sigma_space"]),
            )
        }

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['image']} = cv2.bilateralFilter("
            f"{input_vars['image']}, {int(params['d'])}, "
            f"{float(params['sigma_color'])}, {float(params['sigma_space'])})"
        ]


class SobelNode(BaseNode):
    type = "sobel"
    label = "Sobel"
    category = "filters"
    description = "Sobel gradient magnitude for edge / structure analysis."
    ports = [image_in(), image_out()]
    params = [
        select_param("dx", "Order X", "1", ["0", "1", "2"]),
        select_param("dy", "Order Y", "0", ["0", "1", "2"]),
        int_param("ksize", "Kernel Size", 3, minimum=1, maximum=7),
        number_param("scale", "Scale", 1.0, minimum=0.1, maximum=10.0, step=0.1),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        gray = _as_gray(require_image(inputs))
        dx = int(params["dx"])
        dy = int(params["dy"])
        if dx == 0 and dy == 0:
            dx = 1
        grad = cv2.Sobel(
            gray,
            cv2.CV_64F,
            dx,
            dy,
            ksize=_odd(int(params["ksize"])),
            scale=float(params["scale"]),
        )
        return {"image": cv2.convertScaleAbs(grad)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        dx = int(params["dx"])
        dy = int(params["dy"])
        if dx == 0 and dy == 0:
            dx = 1
        ksize = _odd(int(params["ksize"]))
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            (
                f"_g = cv2.Sobel(_gray, cv2.CV_64F, {dx}, {dy}, "
                f"ksize={ksize}, scale={float(params['scale'])})"
            ),
            f"{dst} = cv2.convertScaleAbs(_g)",
        ]


class LaplacianNode(BaseNode):
    type = "laplacian"
    label = "Laplacian"
    category = "filters"
    description = "Laplacian operator for zero-crossing / blur detection cues."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 3, minimum=1, maximum=31),
        number_param("scale", "Scale", 1.0, minimum=0.1, maximum=10.0, step=0.1),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        gray = _as_gray(require_image(inputs))
        lap = cv2.Laplacian(
            gray,
            cv2.CV_64F,
            ksize=_odd(int(params["ksize"])),
            scale=float(params["scale"]),
        )
        return {"image": cv2.convertScaleAbs(lap)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        ksize = _odd(int(params["ksize"]))
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            (
                f"_l = cv2.Laplacian(_gray, cv2.CV_64F, "
                f"ksize={ksize}, scale={float(params['scale'])})"
            ),
            f"{dst} = cv2.convertScaleAbs(_l)",
        ]


class BoxBlurNode(BaseNode):
    type = "box_blur"
    label = "Box Blur"
    category = "filters"
    description = "Moving-average / box filter blur (uniform kernel convolution)."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 5, minimum=1, maximum=51),
        select_param("normalize", "Normalize", "true", ["true", "false"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        ksize = max(1, int(params["ksize"]))
        normalize = str(params["normalize"]) == "true"
        return {
            "image": cv2.boxFilter(
                require_image(inputs),
                ddepth=-1,
                ksize=(ksize, ksize),
                normalize=normalize,
            )
        }

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        ksize = max(1, int(params["ksize"]))
        normalize = str(params["normalize"]) == "true"
        return [
            f"{output_vars['image']} = cv2.boxFilter("
            f"{input_vars['image']}, -1, ({ksize}, {ksize}), normalize={normalize})"
        ]


class SharpenNode(BaseNode):
    type = "sharpen"
    label = "Sharpen"
    category = "filters"
    description = "Unsharp-mask / Laplacian sharpening via convolution kernel."
    ports = [image_in(), image_out()]
    params = [
        number_param("amount", "Amount", 1.0, minimum=0.1, maximum=5.0, step=0.1),
        select_param("kernel", "Kernel", "laplacian", ["laplacian", "unsharp"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        amount = float(params["amount"])
        if str(params["kernel"]) == "unsharp":
            blurred = cv2.GaussianBlur(image, (0, 0), 3)
            return {
                "image": cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0)
            }
        kernel = np.array(
            [[0, -1, 0], [-1, 4 * amount + 1, -1], [0, -1, 0]],
            dtype=np.float32,
        )
        return {"image": cv2.filter2D(image, -1, kernel)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        amount = float(params["amount"])
        if str(params["kernel"]) == "unsharp":
            return [
                f"_blur = cv2.GaussianBlur({src}, (0, 0), 3)",
                f"{dst} = cv2.addWeighted({src}, {1.0 + amount}, _blur, {-amount}, 0)",
            ]
        center = 4 * amount + 1
        return [
            f"_k = np.array([[0, -1, 0], [-1, {center}, -1], [0, -1, 0]], dtype='float32')",
            f"{dst} = cv2.filter2D({src}, -1, _k)",
        ]
