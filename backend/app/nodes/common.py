"""Shared helpers for OpenCV node implementations."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.models.graph import ParamField, PortDirection, PortSpec


def image_in(
    port_id: str = "image",
    name: str = "Image",
    *,
    optional: bool = False,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.INPUT,
        data_type="image",
        optional=optional,
    )


def image_out(
    port_id: str = "image",
    name: str = "Image",
    *,
    multiple: bool = False,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.OUTPUT,
        data_type="image",
        multiple=multiple,
    )


def mask_in(
    port_id: str = "mask",
    name: str = "Mask",
    *,
    optional: bool = True,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.INPUT,
        data_type="mask",
        optional=optional,
    )


def mask_out(
    port_id: str = "mask",
    name: str = "Mask",
    *,
    multiple: bool = False,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.OUTPUT,
        data_type="mask",
        multiple=multiple,
    )


def bboxes_in(
    port_id: str = "bboxes",
    name: str = "BBoxes",
    *,
    optional: bool = True,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.INPUT,
        data_type="bboxes",
        optional=optional,
    )


def bboxes_out(
    port_id: str = "bboxes",
    name: str = "BBoxes",
    *,
    multiple: bool = False,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.OUTPUT,
        data_type="bboxes",
        multiple=multiple,
    )


def keypoints_in(
    port_id: str = "keypoints",
    name: str = "Keypoints",
    *,
    optional: bool = True,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.INPUT,
        data_type="keypoints",
        optional=optional,
    )


def keypoints_out(
    port_id: str = "keypoints",
    name: str = "Keypoints",
    *,
    multiple: bool = False,
) -> PortSpec:
    return PortSpec(
        id=port_id,
        name=name,
        direction=PortDirection.OUTPUT,
        data_type="keypoints",
        multiple=multiple,
    )


ANNOTATION_DATA_TYPES = frozenset({"bboxes", "keypoints"})
IMAGE_LIKE_DATA_TYPES = frozenset({"image", "mask"})


def require_image(
    inputs: dict[str, np.ndarray | list[np.ndarray] | None],
    port: str = "image",
) -> np.ndarray:
    value = inputs.get(port)
    if value is None:
        raise ValueError(f"Missing required image input '{port}'")
    if isinstance(value, list):
        if not value:
            raise ValueError(f"Empty image list for input '{port}'")
        return value[0]
    return value


def number_param(
    name: str,
    label: str,
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
    step: float | None = None,
    description: str | None = None,
) -> ParamField:
    return ParamField(
        name=name,
        label=label,
        type="number",
        default=default,
        minimum=minimum,
        maximum=maximum,
        step=step,
        description=description,
    )


def int_param(
    name: str,
    label: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
    description: str | None = None,
) -> ParamField:
    return ParamField(
        name=name,
        label=label,
        type="integer",
        default=default,
        minimum=minimum,
        maximum=maximum,
        step=1,
        description=description,
    )


def select_param(
    name: str,
    label: str,
    default: str,
    options: list[str],
    description: str | None = None,
) -> ParamField:
    return ParamField(
        name=name,
        label=label,
        type="select",
        default=default,
        options=options,
        description=description,
    )


def string_param(
    name: str,
    label: str,
    default: str,
    description: str | None = None,
) -> ParamField:
    return ParamField(
        name=name,
        label=label,
        type="string",
        default=default,
        description=description,
    )


IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp", ".gif"]


def file_param(
    name: str,
    label: str,
    default: str = "",
    accept: list[str] | None = None,
    description: str | None = None,
) -> ParamField:
    return ParamField(
        name=name,
        label=label,
        type="file",
        default=default,
        accept=accept or list(IMAGE_EXTENSIONS),
        description=description,
    )


def format_params(params: dict[str, Any]) -> str:
    items = ", ".join(f"{key}={value!r}" for key, value in sorted(params.items()))
    return items
