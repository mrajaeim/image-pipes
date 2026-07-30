"""Catalog-driven Albumentations augment nodes with multi-target ports."""

from __future__ import annotations

from typing import Any

import albumentations as A
import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.models.graph import ParamField
from app.nodes.albumentations_catalog import ALBUMENTATIONS_CATALOG, AlbuEntry, AlbuParam
from app.nodes.common import (
    bboxes_in,
    bboxes_out,
    image_in,
    image_out,
    keypoints_in,
    keypoints_out,
    mask_in,
    mask_out,
    require_image,
)

BORDER_MODE_MAP = {
    "constant": cv2.BORDER_CONSTANT,
    "replicate": cv2.BORDER_REPLICATE,
    "reflect": cv2.BORDER_REFLECT,
    "wrap": cv2.BORDER_WRAP,
    "reflect101": cv2.BORDER_REFLECT_101,
}

AUGMENT_PORTS = [
    image_in(),
    mask_in(),
    bboxes_in(),
    keypoints_in(),
    image_out(),
    mask_out(),
    bboxes_out(),
    keypoints_out(),
]


def _param_field(param: AlbuParam) -> ParamField:
    if param.kind == "boolean":
        return ParamField(
            name=param.name,
            label=param.label,
            type="select",
            default="true" if param.default else "false",
            options=["true", "false"],
            description=param.description,
        )
    if param.kind == "range":
        return ParamField(
            name=param.name,
            label=param.label,
            type="number",
            default=param.default,
            minimum=param.minimum,
            maximum=param.maximum,
            step=param.step,
            description=param.description,
        )
    if param.kind == "integer":
        field_type = "integer"
    elif param.kind == "select":
        field_type = "select"
    else:
        field_type = "number"
    return ParamField(
        name=param.name,
        label=param.label,
        type=field_type,
        default=param.default,
        minimum=param.minimum,
        maximum=param.maximum,
        step=param.step if param.kind != "integer" else 1,
        options=list(param.options) if param.options else None,
        description=param.description,
    )


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}


def _build_kwargs(entry: AlbuEntry, params: dict[str, Any]) -> dict[str, Any]:
    """Map inspector params into Albumentations transform kwargs."""
    by_name = {param.name: param for param in entry.params}
    assembled: dict[str, Any] = {}
    consumed: set[str] = set()

    def take(*names: str) -> None:
        consumed.update(names)

    if entry.class_name == "CLAHE" and "tile_grid_size" in params:
        size = int(params["tile_grid_size"])
        assembled["tile_grid_size"] = (size, size)
        take("tile_grid_size")
    elif entry.class_name == "GaussNoise":
        assembled["std_range"] = (float(params["std_min"]), float(params["std_max"]))
        take("std_min", "std_max")
    elif entry.class_name == "ISONoise":
        assembled["color_shift"] = (
            float(params["color_shift_min"]),
            float(params["color_shift_max"]),
        )
        assembled["intensity"] = (
            float(params["intensity_min"]),
            float(params["intensity_max"]),
        )
        take(
            "color_shift_min",
            "color_shift_max",
            "intensity_min",
            "intensity_max",
        )
    elif entry.class_name == "MultiplicativeNoise":
        assembled["multiplier"] = (
            float(params["multiplier_min"]),
            float(params["multiplier_max"]),
        )
        take("multiplier_min", "multiplier_max")
    elif entry.class_name == "SaltAndPepper":
        assembled["amount"] = (float(params["amount_min"]), float(params["amount_max"]))
        assembled["salt_vs_pepper"] = (
            float(params["salt_min"]),
            float(params["salt_max"]),
        )
        take("amount_min", "amount_max", "salt_min", "salt_max")
    elif entry.class_name == "ImageCompression":
        assembled["quality_range"] = (
            int(params["quality_lower"]),
            int(params["quality_upper"]),
        )
        assembled["compression_type"] = str(params.get("compression_type", "jpeg"))
        take("quality_lower", "quality_upper", "compression_type")
    elif entry.class_name == "Downscale":
        assembled["scale_range"] = (float(params["scale_min"]), float(params["scale_max"]))
        take("scale_min", "scale_max")
    elif entry.class_name == "ChannelDropout":
        assembled["channel_drop_range"] = (
            int(params["channel_drop_min"]),
            int(params["channel_drop_max"]),
        )
        assembled["fill"] = float(params["fill"])
        take("channel_drop_min", "channel_drop_max", "fill")
    elif entry.class_name == "Normalize":
        assembled["mean"] = (
            float(params["mean_r"]),
            float(params["mean_g"]),
            float(params["mean_b"]),
        )
        assembled["std"] = (
            float(params["std_r"]),
            float(params["std_g"]),
            float(params["std_b"]),
        )
        assembled["max_pixel_value"] = float(params["max_pixel_value"])
        take(
            "mean_r",
            "mean_g",
            "mean_b",
            "std_r",
            "std_g",
            "std_b",
            "max_pixel_value",
        )
    elif entry.class_name == "CoarseDropout":
        assembled["num_holes_range"] = (
            int(params["num_holes_min"]),
            int(params["num_holes_max"]),
        )
        assembled["hole_height_range"] = (
            float(params["hole_height_min"]),
            float(params["hole_height_max"]),
        )
        assembled["hole_width_range"] = (
            float(params["hole_width_min"]),
            float(params["hole_width_max"]),
        )
        take(
            "num_holes_min",
            "num_holes_max",
            "hole_height_min",
            "hole_height_max",
            "hole_width_min",
            "hole_width_max",
        )
    elif entry.class_name == "RandomFog":
        assembled["fog_coef_range"] = (
            float(params["fog_coef_min"]),
            float(params["fog_coef_max"]),
        )
        take("fog_coef_min", "fog_coef_max")
    elif entry.class_name == "RandomGamma":
        assembled["gamma_limit"] = (
            float(params["gamma_min"]),
            float(params["gamma_max"]),
        )
        take("gamma_min", "gamma_max")
    elif entry.class_name == "Solarize":
        assembled["threshold_range"] = (
            float(params["threshold_min"]),
            float(params["threshold_max"]),
        )
        take("threshold_min", "threshold_max")
    elif entry.class_name == "Sharpen":
        assembled["alpha"] = (float(params["alpha_min"]), float(params["alpha_max"]))
        assembled["lightness"] = (
            float(params["lightness_min"]),
            float(params["lightness_max"]),
        )
        take("alpha_min", "alpha_max", "lightness_min", "lightness_max")
    elif entry.class_name == "Emboss":
        assembled["alpha"] = (float(params["alpha_min"]), float(params["alpha_max"]))
        assembled["strength"] = (
            float(params["strength_min"]),
            float(params["strength_max"]),
        )
        take("alpha_min", "alpha_max", "strength_min", "strength_max")
    elif entry.class_name == "Affine":
        assembled["scale"] = float(params["scale"])
        assembled["translate_percent"] = float(params["translate_percent"])
        assembled["rotate"] = float(params["rotate"])
        assembled["shear"] = float(params["shear"])
        take("scale", "translate_percent", "rotate", "shear")

    kwargs: dict[str, Any] = dict(assembled)
    for name, value in params.items():
        if name in consumed:
            continue
        spec = by_name.get(name)
        if spec is None:
            continue
        key = spec.albu_key or name
        if key == "border_mode":
            kwargs[key] = BORDER_MODE_MAP.get(str(value), cv2.BORDER_CONSTANT)
        elif spec.kind == "boolean":
            kwargs[key] = _coerce_bool(value)
        elif spec.kind == "range":
            magnitude = float(value)
            kwargs[key] = (-magnitude, magnitude)
        elif spec.kind == "integer":
            kwargs[key] = int(value)
        elif spec.kind == "select":
            kwargs[key] = value
        else:
            kwargs[key] = float(value) if not isinstance(value, str) else value
    return kwargs


def _split_bboxes(raw: Any) -> tuple[list[list[float]], list[str]]:
    if raw is None:
        return [], []
    if not isinstance(raw, list):
        raise ValueError("bboxes input must be a list of [x_min, y_min, x_max, y_max, label?]")
    boxes: list[list[float]] = []
    labels: list[str] = []
    for item in raw:
        if not isinstance(item, (list, tuple)) or len(item) < 4:
            raise ValueError(f"Invalid bbox entry: {item!r}")
        boxes.append([float(item[0]), float(item[1]), float(item[2]), float(item[3])])
        labels.append(str(item[4]) if len(item) >= 5 else "object")
    return boxes, labels


def _join_bboxes(boxes: Any, labels: Any) -> list[list[Any]]:
    result: list[list[Any]] = []
    label_list = list(labels) if labels is not None else []
    for index, box in enumerate(boxes or []):
        coords = [float(box[0]), float(box[1]), float(box[2]), float(box[3])]
        label = label_list[index] if index < len(label_list) else "object"
        result.append([*coords, label])
    return result


def _normalize_keypoints(raw: Any) -> list[list[float]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("keypoints input must be a list of [x, y, ...]")
    points: list[list[float]] = []
    for item in raw:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            raise ValueError(f"Invalid keypoint entry: {item!r}")
        points.append([float(item[0]), float(item[1])])
    return points


def _to_uint8_image(image: np.ndarray) -> np.ndarray:
    if image.dtype == np.uint8:
        return image
    arr = image.astype(np.float32)
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return np.zeros(image.shape, dtype=np.uint8)
    lo, hi = float(finite.min()), float(finite.max())
    if hi - lo < 1e-8:
        scaled = np.zeros_like(arr)
    else:
        scaled = (arr - lo) / (hi - lo) * 255.0
    return np.clip(scaled, 0, 255).astype(np.uint8)


def _prepare_mask(mask: Any) -> np.ndarray | None:
    if mask is None:
        return None
    if isinstance(mask, list):
        if not mask:
            return None
        mask = mask[0]
    if not isinstance(mask, np.ndarray):
        raise ValueError("mask input must be an image array")
    if mask.ndim == 3 and mask.shape[2] > 1:
        return cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    if mask.ndim == 3 and mask.shape[2] == 1:
        return mask[:, :, 0]
    return mask


def run_albumentations(
    entry: AlbuEntry,
    inputs: dict[str, Any],
    params: dict[str, Any],
    seed: int,
) -> dict[str, Any]:
    image = require_image(inputs)
    # Albumentations expects RGB; Image Pipes uses BGR OpenCV convention.
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if image.ndim == 3 else image

    kwargs = _build_kwargs(entry, params)
    transform_cls = getattr(A, entry.class_name)
    transform = transform_cls(**kwargs)

    has_mask = inputs.get("mask") is not None
    has_bboxes = inputs.get("bboxes") is not None
    has_keypoints = inputs.get("keypoints") is not None

    bbox_params = None
    keypoint_params = None
    boxes: list[list[float]] = []
    labels: list[str] = []
    keypoints: list[list[float]] = []

    if has_bboxes:
        boxes, labels = _split_bboxes(inputs.get("bboxes"))
        bbox_params = A.BboxParams(format="pascal_voc", label_fields=["bbox_labels"])
    if has_keypoints:
        keypoints = _normalize_keypoints(inputs.get("keypoints"))
        keypoint_params = A.KeypointParams(format="xy", remove_invisible=False)

    compose = A.Compose(
        [transform],
        bbox_params=bbox_params,
        keypoint_params=keypoint_params,
        seed=seed,
    )

    call: dict[str, Any] = {"image": rgb}
    mask = _prepare_mask(inputs.get("mask")) if has_mask else None
    if mask is not None:
        call["mask"] = mask
    if has_bboxes:
        call["bboxes"] = boxes
        call["bbox_labels"] = labels
    if has_keypoints:
        call["keypoints"] = keypoints

    out = compose(**call)

    out_image = out["image"]
    if out_image.ndim == 3:
        out_image = cv2.cvtColor(_to_uint8_image(out_image), cv2.COLOR_RGB2BGR)
    else:
        out_image = _to_uint8_image(out_image)

    result: dict[str, Any] = {"image": out_image}
    if has_mask and "mask" in out:
        result["mask"] = out["mask"]
    if has_bboxes:
        result["bboxes"] = _join_bboxes(out.get("bboxes", []), out.get("bbox_labels", labels))
    if has_keypoints:
        result["keypoints"] = [
            [float(pt[0]), float(pt[1])] for pt in out.get("keypoints", [])
        ]
    return result


def _emit_python_lines(
    entry: AlbuEntry,
    params: dict[str, Any],
    input_vars: dict[str, str],
    output_vars: dict[str, str],
) -> list[str]:
    kwargs = _build_kwargs(entry, params)
    kwargs_repr = ", ".join(f"{key}={value!r}" for key, value in sorted(kwargs.items()))
    src = input_vars.get("image", "image")
    dst = output_vars.get("image", "image")
    lines = [
        "import albumentations as A",
        f"_rgb = cv2.cvtColor({src}, cv2.COLOR_BGR2RGB) if {src}.ndim == 3 else {src}",
        f"_tf = A.Compose([A.{entry.class_name}({kwargs_repr})], seed=seed)",
        "_out = _tf(image=_rgb)",
        "_img = _out['image']",
        f"{dst} = cv2.cvtColor(_img, cv2.COLOR_RGB2BGR) if _img.ndim == 3 else _img",
    ]
    if "mask" in output_vars and "mask" in input_vars:
        lines.append(f"{output_vars['mask']} = _out.get('mask', {input_vars['mask']})")
    if "bboxes" in output_vars:
        lines.append(f"{output_vars['bboxes']} = _out.get('bboxes', [])")
    if "keypoints" in output_vars:
        lines.append(f"{output_vars['keypoints']} = _out.get('keypoints', [])")
    return lines


def _make_node_class(entry: AlbuEntry) -> type[BaseNode]:
    class_name = f"{entry.class_name}AugNode"

    def execute(
        self: BaseNode,
        inputs: dict[str, Any],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, Any]:
        return run_albumentations(entry, inputs, params, seed)

    def emit_python(
        self: BaseNode,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return _emit_python_lines(entry, params, input_vars, output_vars)

    attrs: dict[str, Any] = {
        "type": entry.node_type,
        "label": entry.label,
        "category": "augment",
        "description": f"[{entry.family}] {entry.description}",
        "ports": list(AUGMENT_PORTS),
        "params": [_param_field(param) for param in entry.params],
        "stochastic": True,
        "execute": execute,
        "emit_python": emit_python,
    }
    return type(class_name, (BaseNode,), attrs)


def build_albumentations_nodes() -> list[BaseNode]:
    nodes: list[BaseNode] = []
    for entry in ALBUMENTATIONS_CATALOG:
        if not hasattr(A, entry.class_name):
            continue
        node_cls = _make_node_class(entry)
        nodes.append(node_cls())
    return nodes
