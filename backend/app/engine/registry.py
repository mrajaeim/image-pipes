"""Node base class and registry pattern."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import numpy as np

from app.models.graph import NodeMetadata, ParamField, PortSpec


class BaseNode(ABC):
    """Abstract processing node with metadata, validation, execute, and codegen."""

    type: str = ""
    label: str = ""
    category: str = "general"
    description: str = ""
    ports: list[PortSpec] = []
    params: list[ParamField] = []
    stochastic: bool = False
    cacheable: bool = True

    def metadata(self) -> NodeMetadata:
        return NodeMetadata(
            type=self.type,
            label=self.label,
            category=self.category,
            description=self.description,
            ports=list(self.ports),
            params=list(self.params),
            stochastic=self.stochastic,
        )

    def default_params(self) -> dict[str, Any]:
        return {field.name: field.default for field in self.params}

    def validate_params(self, params: dict[str, Any]) -> dict[str, Any]:
        merged = self.default_params()
        merged.update(params)
        for field in self.params:
            if field.name not in merged:
                raise ValueError(f"Missing required parameter '{field.name}' for node {self.type}")
            value = merged[field.name]
            numeric = isinstance(value, (int, float))
            if field.minimum is not None and numeric and value < field.minimum:
                raise ValueError(f"Parameter '{field.name}' below minimum {field.minimum}")
            if field.maximum is not None and numeric and value > field.maximum:
                raise ValueError(f"Parameter '{field.name}' above maximum {field.maximum}")
            if field.options is not None and value not in field.options:
                raise ValueError(f"Parameter '{field.name}' must be one of {field.options}")
        return merged

    def prepare_run(self, params: dict[str, Any]) -> None:
        """Hook called before execute/cache lookup (e.g. publish source filenames)."""

    @abstractmethod
    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        """Run the node and return output port mapping."""

    @abstractmethod
    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        """Return Python source lines that reproduce this node's effect."""


class NodeRegistry:
    """Singleton-style registry of node implementations."""

    def __init__(self) -> None:
        self._nodes: dict[str, BaseNode] = {}

    def register(self, node: BaseNode) -> None:
        if not node.type:
            raise ValueError("Node type must be a non-empty string")
        if node.type in self._nodes:
            raise ValueError(f"Node type '{node.type}' is already registered")
        self._nodes[node.type] = node

    def get(self, node_type: str) -> BaseNode:
        try:
            return self._nodes[node_type]
        except KeyError as exc:
            raise KeyError(f"Unknown node type '{node_type}'") from exc

    def has(self, node_type: str) -> bool:
        return node_type in self._nodes

    def list_metadata(self) -> list[NodeMetadata]:
        return [node.metadata() for node in self._nodes.values()]

    def clear(self) -> None:
        self._nodes.clear()


registry = NodeRegistry()
