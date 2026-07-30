"""REST routes for node registry and graph operations."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.models.graph import ExecuteRequest, Graph, NodeMetadata
from app.nodes import register_builtin_nodes
from app.nodes.common import IMAGE_EXTENSIONS
from app.services.codegen import generate_python

router = APIRouter(prefix="/api")

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "outputs"


class CodegenBody(BaseModel):
    graph: Graph
    seed: int = 0


class CodegenResponse(BaseModel):
    code: str


class UploadResponse(BaseModel):
    path: str
    kind: str
    files: list[str]
    count: int


class OutputDirResponse(BaseModel):
    path: str
    name: str


def _allowed_extension(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in {ext.lower() for ext in IMAGE_EXTENSIONS}


@router.get("/nodes", response_model=list[NodeMetadata])
def list_nodes() -> list[NodeMetadata]:
    register_builtin_nodes()
    return registry.list_metadata()


@router.post("/uploads", response_model=UploadResponse)
async def upload_images(
    files: list[UploadFile] = File(...),
    as_folder: bool = False,
    append_to: str | None = None,
) -> UploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uploads_root = UPLOAD_DIR.resolve()

    if append_to:
        target_path = Path(append_to).resolve()
        if uploads_root not in target_path.parents and target_path != uploads_root:
            raise HTTPException(status_code=400, detail="Path is outside uploads directory")
        batch_dir = target_path if target_path.is_dir() else target_path.parent
        if uploads_root not in batch_dir.parents and batch_dir != uploads_root:
            raise HTTPException(status_code=400, detail="Path is outside uploads directory")
        if not batch_dir.is_dir():
            raise HTTPException(status_code=404, detail="Append destination not found")
    else:
        batch_dir = UPLOAD_DIR / uuid.uuid4().hex
        batch_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    for upload in files:
        filename = Path(upload.filename or "").name
        if not filename or not _allowed_extension(filename):
            continue
        target = batch_dir / filename
        if target.exists():
            stem = target.stem
            suffix = target.suffix
            index = 2
            while True:
                candidate = batch_dir / f"{stem}_{index}{suffix}"
                if not candidate.exists():
                    target = candidate
                    break
                index += 1
        content = await upload.read()
        if not content:
            continue
        target.write_bytes(content)
        saved.append(str(target.resolve()))

    if not saved:
        raise HTTPException(
            status_code=400,
            detail=(
                "No supported image files uploaded. "
                f"Allowed extensions: {', '.join(IMAGE_EXTENSIONS)}"
            ),
        )

    total_in_dir = sum(
        1
        for path in batch_dir.iterdir()
        if path.is_file() and _allowed_extension(path.name)
    )
    if as_folder or append_to is not None or len(saved) > 1 or total_in_dir > 1:
        return UploadResponse(
            path=str(batch_dir.resolve()),
            kind="folder",
            files=saved,
            count=len(saved),
        )

    return UploadResponse(
        path=saved[0],
        kind="file",
        files=saved,
        count=1,
    )


@router.delete("/uploads")
def delete_uploaded_file(path: str) -> dict[str, str]:
    """Remove one previously uploaded image (must live under uploads/)."""
    try:
        target = Path(path).resolve()
        uploads_root = UPLOAD_DIR.resolve()
        if uploads_root not in target.parents and target != uploads_root:
            raise HTTPException(status_code=400, detail="Path is outside uploads directory")
        if not target.is_file():
            raise HTTPException(status_code=404, detail="Uploaded file not found")
        target.unlink()
        parent = target.parent
        if parent != uploads_root and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
        return {"status": "deleted", "path": str(target)}
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/outputs", response_model=OutputDirResponse)
def create_output_directory() -> OutputDirResponse:
    """Create a new root folder under outputs/ for Save Image nodes."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex[:12]
    folder = OUTPUT_DIR / name
    folder.mkdir(parents=True, exist_ok=False)
    return OutputDirResponse(path=str(folder.resolve()), name=name)


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
