"""Contour and shape-structure nodes for imaging research."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, int_param, require_image, select_param


def _as_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _as_bgr(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image.copy()


def _binary(image: np.ndarray) -> np.ndarray:
    gray = _as_gray(image)
    if set(np.unique(gray)).issubset({0, 255}):
        return gray
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return binary


def _contour_mode(name: str) -> int:
    return {
        "external": cv2.RETR_EXTERNAL,
        "list": cv2.RETR_LIST,
        "tree": cv2.RETR_TREE,
        "ccomp": cv2.RETR_CCOMP,
    }.get(name, cv2.RETR_EXTERNAL)


def _contour_method(name: str) -> int:
    return {
        "none": cv2.CHAIN_APPROX_NONE,
        "simple": cv2.CHAIN_APPROX_SIMPLE,
        "tc89_l1": cv2.CHAIN_APPROX_TC89_L1,
        "tc89_kcos": cv2.CHAIN_APPROX_TC89_KCOS,
    }.get(name, cv2.CHAIN_APPROX_SIMPLE)


class FindContoursNode(BaseNode):
    type = "find_contours"
    label = "Find Contours"
    category = "analysis"
    description = "Detect contours on a binary/gray image and draw them for inspection."
    ports = [image_in(), image_out()]
    params = [
        select_param("mode", "Retrieval", "external", ["external", "list", "tree", "ccomp"]),
        select_param(
            "method",
            "Approx",
            "simple",
            ["none", "simple", "tc89_l1", "tc89_kcos"],
        ),
        int_param("thickness", "Thickness", 2, minimum=1, maximum=10),
        select_param("overlay", "Overlay", "on_input", ["on_input", "blank"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        binary = _binary(image)
        contours, _ = cv2.findContours(
            binary,
            _contour_mode(str(params["mode"])),
            _contour_method(str(params["method"])),
        )
        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        cv2.drawContours(
            canvas,
            contours,
            -1,
            (0, 255, 128),
            int(params["thickness"]),
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
        mode = {
            "external": "cv2.RETR_EXTERNAL",
            "list": "cv2.RETR_LIST",
            "tree": "cv2.RETR_TREE",
            "ccomp": "cv2.RETR_CCOMP",
        }.get(str(params["mode"]), "cv2.RETR_EXTERNAL")
        method = {
            "none": "cv2.CHAIN_APPROX_NONE",
            "simple": "cv2.CHAIN_APPROX_SIMPLE",
            "tc89_l1": "cv2.CHAIN_APPROX_TC89_L1",
            "tc89_kcos": "cv2.CHAIN_APPROX_TC89_KCOS",
        }.get(str(params["method"]), "cv2.CHAIN_APPROX_SIMPLE")
        blank = str(params["overlay"]) == "blank"
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_uniq = set(np.unique(_gray).tolist())",
            "_bin = _gray if _uniq <= {0, 255} else "
            "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
            f"_cnts, _ = cv2.findContours(_bin, {mode}, {method})",
            (
                f"{dst} = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"{dst} = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            f"cv2.drawContours({dst}, _cnts, -1, (0, 255, 128), {int(params['thickness'])})",
        ]
