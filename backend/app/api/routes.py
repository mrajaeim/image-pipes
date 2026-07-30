"""REST routes for node registry and graph operations."""

from fastapi import APIRouter

from app.engine.registry import registry
from app.models.graph import NodeMetadata
from app.nodes import register_builtin_nodes

router = APIRouter(prefix="/api")


@router.get("/nodes", response_model=list[NodeMetadata])
def list_nodes() -> list[NodeMetadata]:
    register_builtin_nodes()
    return registry.list_metadata()
