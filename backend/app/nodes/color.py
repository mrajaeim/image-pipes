"""Color space transformation nodes."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, require_image


class ToGrayNode(BaseNode):
    type = "to_gray"
    label = "To Grayscale"
    category = "color"
    description = "Convert BGR image to grayscale."
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
            gray = image
        elif image.shape[2] == 4:
            gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
        else:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return {"image": gray}

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
            f"    {dst} = {src}",
            f"elif {src}.shape[2] == 4:",
            f"    {dst} = cv2.cvtColor({src}, cv2.COLOR_BGRA2GRAY)",
            "else:",
            f"    {dst} = cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
        ]


class ToHsvNode(BaseNode):
    type = "to_hsv"
    label = "To HSV"
    category = "color"
    description = "Convert BGR image to HSV."
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
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        return {"image": cv2.cvtColor(image, cv2.COLOR_BGR2HSV)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = cv2.cvtColor({input_vars['image']}, cv2.COLOR_BGR2HSV)"]


class SplitChannelsNode(BaseNode):
    type = "split_channels"
    label = "Split Channels"
    category = "color"
    description = "Split an image into B, G, and R channel outputs."
    ports = [
        image_in(),
        image_out("b", "Blue"),
        image_out("g", "Green"),
        image_out("r", "Red"),
    ]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        if len(image.shape) == 2:
            return {"b": image, "g": image, "r": image}
        channels = cv2.split(image)
        return {"b": channels[0], "g": channels[1], "r": channels[2]}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['b']}, {output_vars['g']}, {output_vars['r']} = "
            f"cv2.split({input_vars['image']})"
        ]


class MergeChannelsNode(BaseNode):
    type = "merge_channels"
    label = "Merge Channels"
    category = "color"
    description = "Merge B, G, and R channel images."
    ports = [
        image_in("b", "Blue"),
        image_in("g", "Green"),
        image_in("r", "Red"),
        image_out(),
    ]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        b = require_image(inputs, "b")
        g = require_image(inputs, "g")
        r = require_image(inputs, "r")
        return {"image": cv2.merge([b, g, r])}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['image']} = cv2.merge(["
            f"{input_vars['b']}, {input_vars['g']}, {input_vars['r']}])"
        ]
