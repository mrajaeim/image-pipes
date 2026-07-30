"""Color space transformation nodes."""

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


class ToLabNode(BaseNode):
    type = "to_lab"
    label = "To LAB"
    category = "color"
    description = "Convert BGR to CIELAB (perceptually uniform color space)."
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
        return {"image": cv2.cvtColor(image, cv2.COLOR_BGR2LAB)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = cv2.cvtColor({input_vars['image']}, cv2.COLOR_BGR2LAB)"]


class InvertNode(BaseNode):
    type = "invert"
    label = "Invert"
    category = "color"
    description = "Invert pixel intensities (photographic negative)."
    ports = [image_in(), image_out()]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        return {"image": cv2.bitwise_not(require_image(inputs))}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = cv2.bitwise_not({input_vars['image']})"]


class ClaheNode(BaseNode):
    type = "clahe"
    label = "CLAHE"
    category = "color"
    description = "Contrast Limited Adaptive Histogram Equalization on luminance."
    ports = [image_in(), image_out()]
    params = [
        number_param("clip_limit", "Clip Limit", 2.0, minimum=0.1, maximum=40.0, step=0.1),
        int_param("tile_grid", "Tile Grid", 8, minimum=2, maximum=32),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        clahe = cv2.createCLAHE(
            clipLimit=float(params["clip_limit"]),
            tileGridSize=(int(params["tile_grid"]), int(params["tile_grid"])),
        )
        if len(image.shape) == 2:
            return {"image": clahe.apply(image)}
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        merged = cv2.merge([clahe.apply(l_chan), a_chan, b_chan])
        return {"image": cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        clip = float(params["clip_limit"])
        tile = int(params["tile_grid"])
        return [
            f"_clahe = cv2.createCLAHE(clipLimit={clip}, tileGridSize=({tile}, {tile}))",
            f"if len({src}.shape) == 2:",
            f"    {dst} = _clahe.apply({src})",
            "else:",
            f"    _lab = cv2.cvtColor({src}, cv2.COLOR_BGR2LAB)",
            "    _l, _a, _b = cv2.split(_lab)",
            "    _merged = cv2.merge([_clahe.apply(_l), _a, _b])",
            f"    {dst} = cv2.cvtColor(_merged, cv2.COLOR_LAB2BGR)",
        ]


class BrightnessContrastNode(BaseNode):
    type = "brightness_contrast"
    label = "Brightness / Contrast"
    category = "color"
    description = "Deterministic brightness and contrast adjustment (alpha/beta)."
    ports = [image_in(), image_out()]
    params = [
        number_param("alpha", "Contrast", 1.0, minimum=0.0, maximum=3.0, step=0.05),
        number_param("beta", "Brightness", 0.0, minimum=-100.0, maximum=100.0, step=1.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        return {
            "image": cv2.convertScaleAbs(
                image,
                alpha=float(params["alpha"]),
                beta=float(params["beta"]),
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
            f"{output_vars['image']} = cv2.convertScaleAbs("
            f"{input_vars['image']}, alpha={float(params['alpha'])}, "
            f"beta={float(params['beta'])})"
        ]


class InRangeNode(BaseNode):
    type = "in_range"
    label = "In Range"
    category = "color"
    description = "Keep pixels inside a color range (cv2.inRange), useful for HSV filtering."
    ports = [image_in(), image_out()]
    params = [
        select_param("space", "Color Space", "hsv", ["bgr", "hsv", "lab"]),
        int_param("c0_min", "Ch0 Min", 0, minimum=0, maximum=255),
        int_param("c0_max", "Ch0 Max", 179, minimum=0, maximum=255),
        int_param("c1_min", "Ch1 Min", 50, minimum=0, maximum=255),
        int_param("c1_max", "Ch1 Max", 255, minimum=0, maximum=255),
        int_param("c2_min", "Ch2 Min", 50, minimum=0, maximum=255),
        int_param("c2_max", "Ch2 Max", 255, minimum=0, maximum=255),
        select_param("output", "Output", "mask", ["mask", "masked_bgr"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        if len(image.shape) == 2:
            bgr = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        elif image.shape[2] == 4:
            bgr = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
        else:
            bgr = image
        space = str(params["space"])
        if space == "hsv":
            converted = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        elif space == "lab":
            converted = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        else:
            converted = bgr
        lower = np.array(
            [int(params["c0_min"]), int(params["c1_min"]), int(params["c2_min"])],
            dtype=np.uint8,
        )
        upper = np.array(
            [int(params["c0_max"]), int(params["c1_max"]), int(params["c2_max"])],
            dtype=np.uint8,
        )
        mask = cv2.inRange(converted, lower, upper)
        if str(params["output"]) == "masked_bgr":
            return {"image": cv2.bitwise_and(bgr, bgr, mask=mask)}
        return {"image": mask}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        space = str(params["space"])
        if space == "hsv":
            convert = "_c = cv2.cvtColor(_bgr, cv2.COLOR_BGR2HSV)"
        elif space == "lab":
            convert = "_c = cv2.cvtColor(_bgr, cv2.COLOR_BGR2LAB)"
        else:
            convert = "_c = _bgr"
        lower = (
            f"[{int(params['c0_min'])}, {int(params['c1_min'])}, {int(params['c2_min'])}]"
        )
        upper = (
            f"[{int(params['c0_max'])}, {int(params['c1_max'])}, {int(params['c2_max'])}]"
        )
        lines = [
            f"_bgr = {src} if len({src}.shape) == 3 else cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)",
            convert,
            f"_mask = cv2.inRange(_c, np.array({lower}, dtype='uint8'), "
            f"np.array({upper}, dtype='uint8'))",
        ]
        if str(params["output"]) == "masked_bgr":
            lines.append(f"{dst} = cv2.bitwise_and(_bgr, _bgr, mask=_mask)")
        else:
            lines.append(f"{dst} = _mask")
        return lines
