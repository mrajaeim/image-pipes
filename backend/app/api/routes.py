"""REST routes for node registry and graph operations."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from urllib.parse import unquote

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.engine.executor import DagExecutor
from app.engine.registry import registry
from app.models.assets import RegisterAssetsRequest, RegisterAssetsResponse
from app.models.graph import ExecuteRequest, Graph, NodeMetadata
from app.nodes import register_builtin_nodes
from app.nodes.common import IMAGE_EXTENSIONS
from app.paths import cache_dir, upload_dir
from app.services import assets as assets_service
from app.services.codegen import generate_python

router = APIRouter(prefix="/api")

CACHE_DIR = cache_dir()
UPLOAD_DIR = upload_dir()


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
    asset_batch_id: str


def _allowed_extension(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in {ext.lower() for ext in IMAGE_EXTENSIONS}


def _sample_lena_path() -> Path | None:
    """Locate bundled Lena used by example templates."""
    candidates = [
        Path(__file__).resolve().parents[2] / "examples" / "lena.png",
        Path.cwd() / "examples" / "lena.png",
    ]
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).resolve().parent / "examples" / "lena.png")
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidates.append(Path(meipass) / "examples" / "lena.png")
    for path in candidates:
        if path.is_file():
            return path
    return None


@router.get("/nodes", response_model=list[NodeMetadata])
def list_nodes() -> list[NodeMetadata]:
    register_builtin_nodes()
    return registry.list_metadata()


@router.get("/sample-image")
def sample_image() -> FileResponse:
    """Return the bundled sample image for example workflows."""
    path = _sample_lena_path()
    if path is None:
        raise HTTPException(status_code=404, detail="Sample image not found")
    return FileResponse(path, media_type="image/png", filename="lena.png")


@router.post("/assets/sample", response_model=RegisterAssetsResponse)
def register_sample_image() -> RegisterAssetsResponse:
    """Register the bundled sample image as an asset batch (no copy)."""
    path = _sample_lena_path()
    if path is None:
        raise HTTPException(status_code=404, detail="Sample image not found")
    try:
        batch = assets_service.register_paths([str(path)], kind="external")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RegisterAssetsResponse(batch=batch, count=len(batch.files))


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
        response_path = str(batch_dir.resolve())
        response_kind = "folder"
    else:
        response_path = saved[0]
        response_kind = "file"

    try:
        if append_to is not None or response_kind == "folder":
            all_files = sorted(
                path
                for path in batch_dir.iterdir()
                if path.is_file() and _allowed_extension(path.name)
            )
            batch = assets_service.register_staged_files(all_files, root=batch_dir)
        else:
            batch = assets_service.register_staged_files([Path(saved[0])])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return UploadResponse(
        path=response_path,
        kind=response_kind,
        files=saved,
        count=len(saved),
        asset_batch_id=batch.id,
    )


@router.post("/assets/register", response_model=RegisterAssetsResponse)
def register_assets(body: RegisterAssetsRequest) -> RegisterAssetsResponse:
    """Register local paths (desktop native pickers) without copying bytes."""
    try:
        batch = assets_service.register_paths(
            body.paths,
            as_folder=body.as_folder,
            append_to=body.append_to,
            kind="folder" if body.as_folder else "external",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RegisterAssetsResponse(batch=batch, count=len(batch.files))


@router.get("/assets/{batch_id}")
def get_asset_batch(batch_id: str) -> RegisterAssetsResponse:
    batch = assets_service.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Asset batch not found")
    return RegisterAssetsResponse(batch=batch, count=len(batch.files))


@router.get("/assets/{batch_id}/files/{name}")
def get_asset_file(batch_id: str, name: str) -> FileResponse:
    batch = assets_service.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Asset batch not found")
    decoded = unquote(name)
    match = next((item for item in batch.files if item.name == decoded), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Asset file not found")
    target = Path(match.path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Asset file missing on disk")
    return FileResponse(target, filename=match.name)


@router.delete("/assets/{batch_id}/files/{name}")
def delete_asset_file(batch_id: str, name: str) -> dict:
    decoded = unquote(name)
    try:
        batch = assets_service.remove_file(batch_id, decoded)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if batch is None:
        return {"status": "deleted", "batch_id": batch_id, "empty": True}
    return {
        "status": "deleted",
        "batch_id": batch_id,
        "empty": False,
        "count": len(batch.files),
    }


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


@router.get("/downloads/{filename}")
def download_result_archive(filename: str) -> FileResponse:
    """Serve a ZIP produced by Save Image nodes during a pipeline run."""
    from app.engine import save_bundle as save_bundle_module

    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid download name")
    outputs = save_bundle_module.OUTPUT_DIR
    target = (outputs / safe_name).resolve()
    outputs_root = outputs.resolve()
    if outputs_root not in target.parents and target != outputs_root:
        raise HTTPException(status_code=400, detail="Path is outside output directory")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Download not found")
    return FileResponse(
        path=target,
        media_type="application/zip",
        filename=safe_name,
    )


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
