"""Unit tests for node registration."""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest

from app.engine.registry import BaseNode, NodeRegistry
from app.models.graph import ParamField, PortDirection, PortSpec


class _PassthroughNode(BaseNode):
    type = "passthrough"
    label = "Passthrough"
    category = "test"
    ports = [
        PortSpec(id="image", name="Image", direction=PortDirection.INPUT),
        PortSpec(id="image", name="Image", direction=PortDirection.OUTPUT),
    ]
    params = [
        ParamField(
            name="gain",
            label="Gain",
            type="number",
            default=1.0,
            minimum=0.0,
            maximum=10.0,
        ),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = inputs.get("image")
        assert isinstance(image, np.ndarray)
        return {"image": (image * float(params["gain"])).astype(image.dtype)}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        return [f"{output_vars['image']} = {input_vars['image']}  # {node_id}"]


def test_register_and_get_node() -> None:
    reg = NodeRegistry()
    node = _PassthroughNode()
    reg.register(node)
    assert reg.has("passthrough")
    assert reg.get("passthrough") is node
    meta = reg.list_metadata()
    assert len(meta) == 1
    assert meta[0].type == "passthrough"
    assert meta[0].label == "Passthrough"


def test_duplicate_registration_raises() -> None:
    reg = NodeRegistry()
    reg.register(_PassthroughNode())
    with pytest.raises(ValueError, match="already registered"):
        reg.register(_PassthroughNode())


def test_unknown_node_raises() -> None:
    reg = NodeRegistry()
    with pytest.raises(KeyError, match="Unknown node type"):
        reg.get("missing")


def test_validate_params_bounds() -> None:
    node = _PassthroughNode()
    assert node.validate_params({})["gain"] == 1.0
    assert node.validate_params({"gain": 2.5})["gain"] == 2.5
    with pytest.raises(ValueError, match="below minimum"):
        node.validate_params({"gain": -1})
    with pytest.raises(ValueError, match="above maximum"):
        node.validate_params({"gain": 99})
