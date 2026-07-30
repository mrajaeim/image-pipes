"""Filter and edge-detection nodes."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, int_param, number_param, require_image


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


class ThresholdNode(BaseNode):
    type = "threshold"
    label = "Threshold"
    category = "filters"
    description = "Binary threshold."
    ports = [image_in(), image_out()]
    params = [
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
        _, result = cv2.threshold(
            image,
            float(params["thresh"]),
            float(params["maxval"]),
            cv2.THRESH_BINARY,
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
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            f"_, {dst} = cv2.threshold(_gray, {float(params['thresh'])}, "
            f"{float(params['maxval'])}, cv2.THRESH_BINARY)",
        ]
