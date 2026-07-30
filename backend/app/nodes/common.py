"""Shared helpers for OpenCV node implementations."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.models.graph import ParamField, PortDirection, PortSpec


def image_in(port_id: str = "image", name: str = "Image") -> PortSpec:
    return PortSpec(id=port_id, name=name, direction=PortDirection.INPUT, data_type="image")


def image_out(port_id: str = "image", name: str = "Image") -> PortSpec:
    return PortSpec(id=port_id, name=name, direction=PortDirection.OUTPUT, data_type="image")


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


def format_params(params: dict[str, Any]) -> str:
    items = ", ".join(f"{key}={value!r}" for key, value in sorted(params.items()))
    return items
