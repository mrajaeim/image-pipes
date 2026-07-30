"""Morphological operations for binary / grayscale research pipelines."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, int_param, require_image, select_param


def _odd(value: int) -> int:
    value = max(1, int(value))
    return value if value % 2 == 1 else value + 1


def _kernel(ksize: int, shape: str) -> np.ndarray:
    size = _odd(ksize)
    morph_shape = {
        "rect": cv2.MORPH_RECT,
        "ellipse": cv2.MORPH_ELLIPSE,
        "cross": cv2.MORPH_CROSS,
    }.get(shape, cv2.MORPH_RECT)
    return cv2.getStructuringElement(morph_shape, (size, size))


class ErodeNode(BaseNode):
    type = "erode"
    label = "Erode"
    category = "morphology"
    description = "Morphological erosion — shrink bright regions / clean speckles."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 3, minimum=1, maximum=31),
        int_param("iterations", "Iterations", 1, minimum=1, maximum=20),
        select_param("shape", "Kernel Shape", "rect", ["rect", "ellipse", "cross"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        kernel = _kernel(int(params["ksize"]), str(params["shape"]))
        return {
            "image": cv2.erode(image, kernel, iterations=int(params["iterations"])),
        }

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        size = _odd(int(params["ksize"]))
        shape = {
            "rect": "cv2.MORPH_RECT",
            "ellipse": "cv2.MORPH_ELLIPSE",
            "cross": "cv2.MORPH_CROSS",
        }.get(str(params["shape"]), "cv2.MORPH_RECT")
        return [
            f"_k = cv2.getStructuringElement({shape}, ({size}, {size}))",
            (
                f"{output_vars['image']} = cv2.erode("
                f"{input_vars['image']}, _k, iterations={int(params['iterations'])})"
            ),
        ]


class DilateNode(BaseNode):
    type = "dilate"
    label = "Dilate"
    category = "morphology"
    description = "Morphological dilation — expand bright regions / fill gaps."
    ports = [image_in(), image_out()]
    params = [
        int_param("ksize", "Kernel Size", 3, minimum=1, maximum=31),
        int_param("iterations", "Iterations", 1, minimum=1, maximum=20),
        select_param("shape", "Kernel Shape", "rect", ["rect", "ellipse", "cross"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        kernel = _kernel(int(params["ksize"]), str(params["shape"]))
        return {
            "image": cv2.dilate(image, kernel, iterations=int(params["iterations"])),
        }

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        size = _odd(int(params["ksize"]))
        shape = {
            "rect": "cv2.MORPH_RECT",
            "ellipse": "cv2.MORPH_ELLIPSE",
            "cross": "cv2.MORPH_CROSS",
        }.get(str(params["shape"]), "cv2.MORPH_RECT")
        return [
            f"_k = cv2.getStructuringElement({shape}, ({size}, {size}))",
            (
                f"{output_vars['image']} = cv2.dilate("
                f"{input_vars['image']}, _k, iterations={int(params['iterations'])})"
            ),
        ]


class MorphologyExNode(BaseNode):
    type = "morphology_ex"
    label = "Morphology Ex"
    category = "morphology"
    description = "Open, close, gradient, tophat, or blackhat morphology."
    ports = [image_in(), image_out()]
    params = [
        select_param(
            "op",
            "Operation",
            "open",
            ["open", "close", "gradient", "tophat", "blackhat"],
        ),
        int_param("ksize", "Kernel Size", 5, minimum=1, maximum=31),
        select_param("shape", "Kernel Shape", "ellipse", ["rect", "ellipse", "cross"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        op = {
            "open": cv2.MORPH_OPEN,
            "close": cv2.MORPH_CLOSE,
            "gradient": cv2.MORPH_GRADIENT,
            "tophat": cv2.MORPH_TOPHAT,
            "blackhat": cv2.MORPH_BLACKHAT,
        }.get(str(params["op"]), cv2.MORPH_OPEN)
        kernel = _kernel(int(params["ksize"]), str(params["shape"]))
        return {"image": cv2.morphologyEx(require_image(inputs), op, kernel)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        size = _odd(int(params["ksize"]))
        shape = {
            "rect": "cv2.MORPH_RECT",
            "ellipse": "cv2.MORPH_ELLIPSE",
            "cross": "cv2.MORPH_CROSS",
        }.get(str(params["shape"]), "cv2.MORPH_ELLIPSE")
        op = {
            "open": "cv2.MORPH_OPEN",
            "close": "cv2.MORPH_CLOSE",
            "gradient": "cv2.MORPH_GRADIENT",
            "tophat": "cv2.MORPH_TOPHAT",
            "blackhat": "cv2.MORPH_BLACKHAT",
        }.get(str(params["op"]), "cv2.MORPH_OPEN")
        return [
            f"_k = cv2.getStructuringElement({shape}, ({size}, {size}))",
            f"{output_vars['image']} = cv2.morphologyEx({input_vars['image']}, {op}, _k)",
        ]
