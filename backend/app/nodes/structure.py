"""Contour and shape-structure nodes for imaging research."""

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


class ConvexHullNode(BaseNode):
    type = "convex_hull"
    label = "Convex Hull"
    category = "analysis"
    description = "Compute and draw convex hulls for each external contour."
    ports = [image_in(), image_out()]
    params = [
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
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        for contour in contours:
            if len(contour) < 3:
                continue
            hull = cv2.convexHull(contour)
            cv2.drawContours(canvas, [hull], -1, (255, 160, 0), int(params["thickness"]))
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
        blank = str(params["overlay"]) == "blank"
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_uniq = set(np.unique(_gray).tolist())",
            "_bin = _gray if _uniq <= {0, 255} else "
            "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
            "_cnts, _ = cv2.findContours(_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)",
            (
                f"{dst} = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"{dst} = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            "for _c in _cnts:",
            "    if len(_c) < 3: continue",
            "    _hull = cv2.convexHull(_c)",
            f"    cv2.drawContours({dst}, [_hull], -1, (255, 160, 0), {int(params['thickness'])})",
        ]


class ImageMomentsNode(BaseNode):
    type = "moments"
    label = "Moments"
    category = "analysis"
    description = "Draw contour centroids and orientation from spatial moments."
    ports = [image_in(), image_out()]
    params = [
        int_param("min_area", "Min Area", 20, minimum=1, maximum=100000),
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
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        min_area = float(params["min_area"])
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area:
                continue
            moments = cv2.moments(contour)
            if abs(moments["m00"]) < 1e-6:
                continue
            cx = int(moments["m10"] / moments["m00"])
            cy = int(moments["m01"] / moments["m00"])
            cv2.circle(canvas, (cx, cy), 4, (0, 200, 255), -1)
            cv2.drawContours(canvas, [contour], -1, (80, 180, 255), 1)
            # Orientation from central moments / covariance.
            mu20 = moments["mu20"] / moments["m00"]
            mu02 = moments["mu02"] / moments["m00"]
            mu11 = moments["mu11"] / moments["m00"]
            angle = 0.5 * np.arctan2(2 * mu11, mu20 - mu02)
            length = max(12.0, np.sqrt(area) * 0.35)
            dx = int(length * np.cos(angle))
            dy = int(length * np.sin(angle))
            cv2.line(canvas, (cx - dx, cy - dy), (cx + dx, cy + dy), (0, 255, 180), 2)
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
        blank = str(params["overlay"]) == "blank"
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_uniq = set(np.unique(_gray).tolist())",
            "_bin = _gray if _uniq <= {0, 255} else "
            "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
            "_cnts, _ = cv2.findContours(_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)",
            (
                f"{dst} = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"{dst} = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            "for _c in _cnts:",
            f"    if cv2.contourArea(_c) < {float(params['min_area'])}: continue",
            "    _m = cv2.moments(_c)",
            "    if abs(_m['m00']) < 1e-6: continue",
            "    _cx = int(_m['m10'] / _m['m00']); _cy = int(_m['m01'] / _m['m00'])",
            f"    cv2.circle({dst}, (_cx, _cy), 4, (0, 200, 255), -1)",
            f"    cv2.drawContours({dst}, [_c], -1, (80, 180, 255), 1)",
        ]


class ConnectedComponentsNode(BaseNode):
    type = "connected_components"
    label = "Connected Components"
    category = "analysis"
    description = "Label connected regions and draw boxes or a color map."
    ports = [image_in(), image_out()]
    params = [
        select_param("connectivity", "Connectivity", "8", ["4", "8"]),
        int_param("min_area", "Min Area", 20, minimum=1, maximum=100000),
        select_param("mode", "Mode", "boxes", ["boxes", "labels"]),
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
        connectivity = 4 if str(params["connectivity"]) == "4" else 8
        count, labels, stats, _centroids = cv2.connectedComponentsWithStats(
            binary,
            connectivity=connectivity,
        )
        min_area = int(params["min_area"])
        if str(params["mode"]) == "labels":
            canvas = np.zeros((*binary.shape, 3), dtype=np.uint8)
            rng = np.random.default_rng(seed)
            for label_id in range(1, count):
                area = int(stats[label_id, cv2.CC_STAT_AREA])
                if area < min_area:
                    continue
                color = tuple(int(c) for c in rng.integers(64, 256, size=3))
                canvas[labels == label_id] = color
            return {"image": canvas}

        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        for label_id in range(1, count):
            area = int(stats[label_id, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            x = int(stats[label_id, cv2.CC_STAT_LEFT])
            y = int(stats[label_id, cv2.CC_STAT_TOP])
            w = int(stats[label_id, cv2.CC_STAT_WIDTH])
            h = int(stats[label_id, cv2.CC_STAT_HEIGHT])
            cv2.rectangle(canvas, (x, y), (x + w - 1, y + h - 1), (0, 255, 120), 2)
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
        connectivity = 4 if str(params["connectivity"]) == "4" else 8
        min_area = int(params["min_area"])
        blank = str(params["overlay"]) == "blank"
        if str(params["mode"]) == "labels":
            return [
                f"_gray = {src} if len({src}.shape) == 2 else "
                f"cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
                "_uniq = set(np.unique(_gray).tolist())",
                "_bin = _gray if _uniq <= {0, 255} else "
                "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
                f"_n, _lab, _st, _ = cv2.connectedComponentsWithStats("
                f"_bin, connectivity={connectivity})",
                f"{dst} = np.zeros((_bin.shape[0], _bin.shape[1], 3), dtype='uint8')",
                "_rng = np.random.default_rng(0)",
                "for _i in range(1, _n):",
                f"    if int(_st[_i, cv2.CC_STAT_AREA]) < {min_area}: continue",
                "    _col = tuple(int(c) for c in _rng.integers(64, 256, size=3))",
                f"    {dst}[_lab == _i] = _col",
            ]
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_uniq = set(np.unique(_gray).tolist())",
            "_bin = _gray if _uniq <= {0, 255} else "
            "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
            f"_n, _lab, _st, _ = cv2.connectedComponentsWithStats("
            f"_bin, connectivity={connectivity})",
            (
                f"{dst} = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"{dst} = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            "for _i in range(1, _n):",
            f"    if int(_st[_i, cv2.CC_STAT_AREA]) < {min_area}: continue",
            "    _x = int(_st[_i, cv2.CC_STAT_LEFT]); _y = int(_st[_i, cv2.CC_STAT_TOP])",
            "    _w = int(_st[_i, cv2.CC_STAT_WIDTH]); _h = int(_st[_i, cv2.CC_STAT_HEIGHT])",
            f"    cv2.rectangle({dst}, (_x, _y), (_x+_w-1, _y+_h-1), (0, 255, 120), 2)",
        ]


class BlobDetectNode(BaseNode):
    type = "blob_detect"
    label = "Blob Detect"
    category = "analysis"
    description = "Detect blob keypoints with OpenCV SimpleBlobDetector."
    ports = [image_in(), image_out()]
    params = [
        number_param("min_area", "Min Area", 20.0, minimum=1.0, maximum=100000.0),
        number_param("max_area", "Max Area", 5000.0, minimum=1.0, maximum=1000000.0),
        number_param(
            "min_circularity",
            "Min Circularity",
            0.1,
            minimum=0.0,
            maximum=1.0,
            step=0.05,
        ),
        number_param(
            "min_convexity",
            "Min Convexity",
            0.5,
            minimum=0.0,
            maximum=1.0,
            step=0.05,
        ),
        number_param(
            "min_inertia",
            "Min Inertia",
            0.1,
            minimum=0.0,
            maximum=1.0,
            step=0.05,
        ),
        select_param("overlay", "Overlay", "on_input", ["on_input", "blank"]),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        gray = _as_gray(image)
        blob_params = cv2.SimpleBlobDetector_Params()
        blob_params.filterByArea = True
        blob_params.minArea = float(params["min_area"])
        blob_params.maxArea = float(params["max_area"])
        blob_params.filterByCircularity = True
        blob_params.minCircularity = float(params["min_circularity"])
        blob_params.filterByConvexity = True
        blob_params.minConvexity = float(params["min_convexity"])
        blob_params.filterByInertia = True
        blob_params.minInertiaRatio = float(params["min_inertia"])
        blob_params.filterByColor = False
        detector = cv2.SimpleBlobDetector_create(blob_params)
        keypoints = detector.detect(gray)
        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        return {
            "image": cv2.drawKeypoints(
                canvas,
                keypoints,
                np.array([]),
                (0, 140, 255),
                cv2.DRAW_MATCHES_FLAGS_DRAW_RICH_KEYPOINTS,
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
        blank = str(params["overlay"]) == "blank"
        return [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_bp = cv2.SimpleBlobDetector_Params()",
            "_bp.filterByArea = True",
            f"_bp.minArea = {float(params['min_area'])}",
            f"_bp.maxArea = {float(params['max_area'])}",
            "_bp.filterByCircularity = True",
            f"_bp.minCircularity = {float(params['min_circularity'])}",
            "_bp.filterByConvexity = True",
            f"_bp.minConvexity = {float(params['min_convexity'])}",
            "_bp.filterByInertia = True",
            f"_bp.minInertiaRatio = {float(params['min_inertia'])}",
            "_bp.filterByColor = False",
            "_det = cv2.SimpleBlobDetector_create(_bp)",
            "_kps = _det.detect(_gray)",
            (
                "_base = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"_base = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            (
                f"{dst} = cv2.drawKeypoints(_base, _kps, np.array([]), (0, 140, 255), "
                "cv2.DRAW_MATCHES_FLAGS_DRAW_RICH_KEYPOINTS)"
            ),
        ]


class BoundingRectNode(BaseNode):
    type = "bounding_rect"
    label = "Bounding Rect"
    category = "analysis"
    description = "Draw axis-aligned or rotated bounding rectangles for contours."
    ports = [image_in(), image_out()]
    params = [
        select_param("kind", "Kind", "axis", ["axis", "rotated"]),
        int_param("min_area", "Min Area", 20, minimum=1, maximum=100000),
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
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if str(params["overlay"]) == "blank":
            canvas = np.zeros_like(_as_bgr(image))
        else:
            canvas = _as_bgr(image)
        min_area = float(params["min_area"])
        thickness = int(params["thickness"])
        rotated = str(params["kind"]) == "rotated"
        for contour in contours:
            if cv2.contourArea(contour) < min_area:
                continue
            if rotated:
                rect = cv2.minAreaRect(contour)
                box = np.int32(cv2.boxPoints(rect))
                cv2.drawContours(canvas, [box], 0, (255, 80, 80), thickness)
            else:
                x, y, w, h = cv2.boundingRect(contour)
                cv2.rectangle(canvas, (x, y), (x + w - 1, y + h - 1), (255, 80, 80), thickness)
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
        blank = str(params["overlay"]) == "blank"
        thickness = int(params["thickness"])
        min_area = float(params["min_area"])
        rotated = str(params["kind"]) == "rotated"
        lines = [
            f"_gray = {src} if len({src}.shape) == 2 else cv2.cvtColor({src}, cv2.COLOR_BGR2GRAY)",
            "_uniq = set(np.unique(_gray).tolist())",
            "_bin = _gray if _uniq <= {0, 255} else "
            "cv2.threshold(_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]",
            "_cnts, _ = cv2.findContours(_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)",
            (
                f"{dst} = np.zeros((_gray.shape[0], _gray.shape[1], 3), dtype='uint8')"
                if blank
                else (
                    f"{dst} = {src}.copy() if len({src}.shape) == 3 else "
                    f"cv2.cvtColor({src}, cv2.COLOR_GRAY2BGR)"
                )
            ),
            "for _c in _cnts:",
            f"    if cv2.contourArea(_c) < {min_area}: continue",
        ]
        if rotated:
            lines.extend(
                [
                    "    _box = np.int32(cv2.boxPoints(cv2.minAreaRect(_c)))",
                    f"    cv2.drawContours({dst}, [_box], 0, (255, 80, 80), {thickness})",
                ]
            )
        else:
            lines.extend(
                [
                    "    _x, _y, _w, _h = cv2.boundingRect(_c)",
                    (
                        f"    cv2.rectangle({dst}, (_x, _y), (_x+_w-1, _y+_h-1), "
                        f"(255, 80, 80), {thickness})"
                    ),
                ]
            )
        return lines
