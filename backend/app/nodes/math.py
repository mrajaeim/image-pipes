"""Mathematical and bitwise OpenCV image operations."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import (
    image_in,
    image_out,
    number_param,
    require_image,
    select_param,
)


def _as_mask(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _resize_to(image: np.ndarray, size_hw: tuple[int, int], nearest: bool = False) -> np.ndarray:
    height, width = size_hw
    if image.shape[0] == height and image.shape[1] == width:
        return image
    interpolation = cv2.INTER_NEAREST if nearest else cv2.INTER_LINEAR
    return cv2.resize(image, (width, height), interpolation=interpolation)


def _align_pair(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    b = _resize_to(b, (a.shape[0], a.shape[1]))
    if len(a.shape) == 2 and len(b.shape) == 3:
        a = cv2.cvtColor(a, cv2.COLOR_GRAY2BGR)
    elif len(a.shape) == 3 and len(b.shape) == 2:
        b = cv2.cvtColor(b, cv2.COLOR_GRAY2BGR)
    elif len(a.shape) == 3 and len(b.shape) == 3 and a.shape[2] != b.shape[2]:
        if a.shape[2] == 4:
            a = cv2.cvtColor(a, cv2.COLOR_BGRA2BGR)
        if b.shape[2] == 4:
            b = cv2.cvtColor(b, cv2.COLOR_BGRA2BGR)
        if a.shape[2] != b.shape[2]:
            raise ValueError("Images must have compatible channel counts")
    return a, b


def _optional_mask(
    inputs: dict[str, np.ndarray | list[np.ndarray] | None],
    size_hw: tuple[int, int],
) -> np.ndarray | None:
    value = inputs.get("mask")
    if value is None:
        return None
    if isinstance(value, list):
        if not value:
            return None
        mask = value[0]
    else:
        mask = value
    return _resize_to(_as_mask(mask), size_hw, nearest=True)


class ApplyMaskNode(BaseNode):
    type = "apply_mask"
    label = "Apply Mask"
    category = "math"
    description = "Keep image pixels where the mask is non-zero; zero elsewhere (or fill)."
    ports = [
        image_in(),
        image_in("mask", "Mask"),
        image_out(),
    ]
    params = [
        select_param(
            "fill",
            "Outside Mask",
            "black",
            ["black", "white", "unchanged"],
            description="How to treat pixels where mask == 0",
        ),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        mask = _resize_to(_as_mask(require_image(inputs, "mask")), image.shape[:2], nearest=True)
        fill = str(params["fill"])
        if fill == "unchanged":
            return {"image": image.copy()}
        masked = cv2.bitwise_and(image, image, mask=mask)
        if fill == "white":
            inv = cv2.bitwise_not(mask)
            white = np.full_like(image, 255)
            background = cv2.bitwise_and(white, white, mask=inv)
            return {"image": cv2.add(masked, background)}
        return {"image": masked}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        mask = input_vars["mask"]
        dst = output_vars["image"]
        fill = str(params["fill"])
        lines = [
            (
                f"_mask = {mask} if len({mask}.shape) == 2 else "
                f"cv2.cvtColor({mask}, cv2.COLOR_BGR2GRAY)"
            ),
            (
                f"_mask = cv2.resize(_mask, ({src}.shape[1], {src}.shape[0]), "
                "interpolation=cv2.INTER_NEAREST)"
            ),
        ]
        if fill == "unchanged":
            lines.append(f"{dst} = {src}.copy()")
        elif fill == "white":
            lines.extend(
                [
                    f"_kept = cv2.bitwise_and({src}, {src}, mask=_mask)",
                    "_inv = cv2.bitwise_not(_mask)",
                    (
                        f"_bg = cv2.bitwise_and(np.full_like({src}, 255), "
                        f"np.full_like({src}, 255), mask=_inv)"
                    ),
                    f"{dst} = cv2.add(_kept, _bg)",
                ]
            )
        else:
            lines.append(f"{dst} = cv2.bitwise_and({src}, {src}, mask=_mask)")
        return lines


class BitwiseNode(BaseNode):
    type = "bitwise"
    label = "Bitwise"
    category = "math"
    description = "Bitwise AND / OR / XOR between two images, with optional mask."
    ports = [
        image_in("a", "Image A"),
        image_in("b", "Image B"),
        image_in("mask", "Mask", optional=True),
        image_out(),
    ]
    params = [
        select_param("op", "Operation", "and", ["and", "or", "xor"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        a, b = _align_pair(require_image(inputs, "a"), require_image(inputs, "b"))
        mask = _optional_mask(inputs, a.shape[:2])
        op = str(params["op"])
        if op == "or":
            result = cv2.bitwise_or(a, b, mask=mask)
        elif op == "xor":
            result = cv2.bitwise_xor(a, b, mask=mask)
        else:
            result = cv2.bitwise_and(a, b, mask=mask)
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        op = str(params["op"])
        fn = {"and": "bitwise_and", "or": "bitwise_or", "xor": "bitwise_xor"}.get(
            op, "bitwise_and"
        )
        a = input_vars["a"]
        b = input_vars["b"]
        dst = output_vars["image"]
        if "mask" in input_vars:
            return [
                f"{dst} = cv2.{fn}({a}, {b}, mask={input_vars['mask']})",
            ]
        return [f"{dst} = cv2.{fn}({a}, {b})"]


class AbsDiffNode(BaseNode):
    type = "absdiff"
    label = "Abs Diff"
    category = "math"
    description = "Absolute per-pixel difference between two images."
    ports = [
        image_in("a", "Image A"),
        image_in("b", "Image B"),
        image_out(),
    ]
    params = []

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        a, b = _align_pair(require_image(inputs, "a"), require_image(inputs, "b"))
        return {"image": cv2.absdiff(a, b)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [
            f"{output_vars['image']} = cv2.absdiff({input_vars['a']}, {input_vars['b']})"
        ]


class AddWeightedNode(BaseNode):
    type = "add_weighted"
    label = "Add Weighted"
    category = "math"
    description = "Blend two images: alpha*A + beta*B + gamma."
    ports = [
        image_in("a", "Image A"),
        image_in("b", "Image B"),
        image_out(),
    ]
    params = [
        number_param("alpha", "Alpha (A)", 0.5, minimum=0.0, maximum=2.0, step=0.05),
        number_param("beta", "Beta (B)", 0.5, minimum=0.0, maximum=2.0, step=0.05),
        number_param("gamma", "Gamma", 0.0, minimum=-100.0, maximum=100.0, step=1.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        a, b = _align_pair(require_image(inputs, "a"), require_image(inputs, "b"))
        return {
            "image": cv2.addWeighted(
                a,
                float(params["alpha"]),
                b,
                float(params["beta"]),
                float(params["gamma"]),
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
            (
                f"{output_vars['image']} = cv2.addWeighted("
                f"{input_vars['a']}, {float(params['alpha'])}, "
                f"{input_vars['b']}, {float(params['beta'])}, "
                f"{float(params['gamma'])})"
            )
        ]


class ArithmeticNode(BaseNode):
    type = "arithmetic"
    label = "Arithmetic"
    category = "math"
    description = "Saturated add / subtract / multiply of two images."
    ports = [
        image_in("a", "Image A"),
        image_in("b", "Image B"),
        image_in("mask", "Mask", optional=True),
        image_out(),
    ]
    params = [
        select_param("op", "Operation", "add", ["add", "subtract", "multiply"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        a, b = _align_pair(require_image(inputs, "a"), require_image(inputs, "b"))
        mask = _optional_mask(inputs, a.shape[:2])
        op = str(params["op"])
        if op == "subtract":
            result = cv2.subtract(a, b, mask=mask)
        elif op == "multiply":
            result = cv2.multiply(a, b)
            if mask is not None:
                result = cv2.bitwise_and(result, result, mask=mask)
        else:
            result = cv2.add(a, b, mask=mask)
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        op = str(params["op"])
        a = input_vars["a"]
        b = input_vars["b"]
        dst = output_vars["image"]
        mask = input_vars.get("mask")
        if op == "multiply":
            lines = [f"{dst} = cv2.multiply({a}, {b})"]
            if mask:
                lines.append(f"{dst} = cv2.bitwise_and({dst}, {dst}, mask={mask})")
            return lines
        fn = "subtract" if op == "subtract" else "add"
        if mask:
            return [f"{dst} = cv2.{fn}({a}, {b}, mask={mask})"]
        return [f"{dst} = cv2.{fn}({a}, {b})"]
