"""Pydantic schemas for DAG graph data and execution."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class PortDirection(StrEnum):
    INPUT = "input"
    OUTPUT = "output"


class PortSpec(BaseModel):
    id: str
    name: str
    direction: PortDirection
    data_type: str = "image"
    multiple: bool = False
    optional: bool = False


class NodeInstance(BaseModel):
    id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})


class Edge(BaseModel):
    id: str
    source: str
    source_port: str = "image"
    target: str
    target_port: str = "image"
    # Frontend-only bend anchors; ignored by the executor.
    waypoints: list[dict[str, float]] | None = None


class Graph(BaseModel):
    nodes: list[NodeInstance] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)


class ExecuteRequest(BaseModel):
    graph: Graph
    seed: int = 0
    sample_count: int = 1
    cache: bool = True
    target_node_id: str | None = None


class ExecutionEventType(StrEnum):
    PROGRESS = "progress"
    PREVIEW = "preview"
    LOG = "log"
    ERROR = "error"
    DONE = "done"
    CANCELLED = "cancelled"
    DOWNLOAD = "download"
    SAVED = "saved"


class ExecutionEvent(BaseModel):
    type: ExecutionEventType
    node_id: str | None = None
    port_id: str | None = None
    message: str | None = None
    progress: float | None = None
    image_b64: str | None = None
    sample_index: int | None = None
    iteration: int | None = None
    batch_index: int | None = None
    cache_hit: bool | None = None
    duration_ms: float | None = None
    data: dict[str, Any] | None = None
    download_url: str | None = None
    download_filename: str | None = None
    saved_dir: str | None = None


class ParamField(BaseModel):
    name: str
    label: str
    type: str
    default: Any = None
    minimum: float | None = None
    maximum: float | None = None
    step: float | None = None
    options: list[str] | None = None
    accept: list[str] | None = None
    description: str | None = None


class NodeMetadata(BaseModel):
    type: str
    label: str
    category: str
    description: str = ""
    ports: list[PortSpec] = Field(default_factory=list)
    params: list[ParamField] = Field(default_factory=list)
    stochastic: bool = False
