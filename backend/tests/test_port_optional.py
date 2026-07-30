"""Tests for optional PortSpec metadata."""

from __future__ import annotations

from app.models.graph import PortDirection, PortSpec
from app.nodes.common import image_in


def test_port_spec_optional_defaults_false() -> None:
    port = PortSpec(id="image", name="Image", direction=PortDirection.INPUT)
    assert port.optional is False


def test_image_in_optional_flag() -> None:
    port = image_in("size_ref", "Size Ref", optional=True)
    assert port.id == "size_ref"
    assert port.optional is True
    assert port.direction == PortDirection.INPUT
