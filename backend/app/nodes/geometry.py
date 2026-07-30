"""Geometry transformation nodes."""

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


class ResizeNode(BaseNode):
    type = "resize"
    label = "Resize"
    category = "geometry"
    description = "Resize an image to a target width and height."
    ports = [image_in(), image_out()]
    params = [
        int_param("width", "Width", 256, minimum=1, maximum=8192),
        int_param("height", "Height", 256, minimum=1, maximum=8192),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        size = (int(params["width"]), int(params["height"]))
        return {"image": cv2.resize(image, size, interpolation=cv2.INTER_LINEAR)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['image']} = cv2.resize("
            f"{input_vars['image']}, ({int(params['width'])}, {int(params['height'])}), "
            "interpolation=cv2.INTER_LINEAR)"
        ]


class RotateNode(BaseNode):
    type = "rotate"
    label = "Rotate"
    category = "geometry"
    description = "Rotate an image around its center."
    ports = [image_in(), image_out()]
    params = [number_param("angle", "Angle", 0.0, minimum=-360.0, maximum=360.0, step=1.0)]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        height, width = image.shape[:2]
        matrix = cv2.getRotationMatrix2D((width / 2, height / 2), float(params["angle"]), 1.0)
        return {"image": cv2.warpAffine(image, matrix, (width, height))}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        angle = float(params["angle"])
        return [
            f"_h, _w = {src}.shape[:2]",
            f"_m = cv2.getRotationMatrix2D((_w / 2, _h / 2), {angle}, 1.0)",
            f"{dst} = cv2.warpAffine({src}, _m, (_w, _h))",
        ]


class CropNode(BaseNode):
    type = "crop"
    label = "Crop"
    category = "geometry"
    description = "Crop a rectangular region."
    ports = [image_in(), image_out()]
    params = [
        int_param("x", "X", 0, minimum=0),
        int_param("y", "Y", 0, minimum=0),
        int_param("width", "Width", 100, minimum=1),
        int_param("height", "Height", 100, minimum=1),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        x = int(params["x"])
        y = int(params["y"])
        width = int(params["width"])
        height = int(params["height"])
        return {"image": image[y : y + height, x : x + width].copy()}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        x, y = int(params["x"]), int(params["y"])
        width, height = int(params["width"]), int(params["height"])
        return [
            (
                f"{output_vars['image']} = "
                f"{input_vars['image']}[{y}:{y + height}, {x}:{x + width}].copy()"
            )
        ]


class FlipNode(BaseNode):
    type = "flip"
    label = "Flip"
    category = "geometry"
    description = "Flip an image horizontally, vertically, or both."
    ports = [image_in(), image_out()]
    params = [
        select_param(
            "mode",
            "Mode",
            "horizontal",
            ["horizontal", "vertical", "both"],
        )
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        mode = str(params["mode"])
        code = {"horizontal": 1, "vertical": 0, "both": -1}[mode]
        return {"image": cv2.flip(require_image(inputs), code)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        code = {"horizontal": 1, "vertical": 0, "both": -1}[str(params["mode"])]
        return [f"{output_vars['image']} = cv2.flip({input_vars['image']}, {code})"]
