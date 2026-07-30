"""REST routes for node registry and graph operations."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.models.graph import ExecuteRequest, Graph, NodeMetadata
from app.nodes import register_builtin_nodes
from app.services.codegen import generate_python

router = APIRouter(prefix="/api")

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"


class CodegenBody(BaseModel):
    graph: Graph
    seed: int = 0


class CodegenResponse(BaseModel):
    code: str


@router.get("/nodes", response_model=list[NodeMetadata])
def list_nodes() -> list[NodeMetadata]:
    register_builtin_nodes()
    return registry.list_metadata()


@router.post("/execute")
def execute_graph(request: ExecuteRequest) -> dict:
    register_builtin_nodes()
    try:
        executor = DagExecutor(CACHE_DIR)
        return executor.execute(request)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/codegen", response_model=CodegenResponse)
def codegen(body: CodegenBody) -> CodegenResponse:
    register_builtin_nodes()
    try:
        return CodegenResponse(code=generate_python(body.graph, seed=body.seed))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
