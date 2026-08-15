"""REST API for versioned reusable user scripts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.nodes.user_script import refresh_user_script
from app.services import user_scripts as scripts_store

router = APIRouter(prefix="/user-scripts", tags=["user-scripts"])


class UserScriptMetaResponse(BaseModel):
    id: str
    name: str
    current_version: int
    created_at: str
    updated_at: str
    node_type: str


class CreateUserScriptBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    code: str = Field(min_length=1)


class NewVersionBody(BaseModel):
    code: str = Field(min_length=1)


class UserScriptCodeResponse(BaseModel):
    id: str
    version: int
    code: str


def _meta_response(meta: scripts_store.UserScriptMeta) -> UserScriptMetaResponse:
    return UserScriptMetaResponse(
        id=meta.id,
        name=meta.name,
        current_version=meta.current_version,
        created_at=meta.created_at,
        updated_at=meta.updated_at,
        node_type=meta.node_type(),
    )


@router.get("", response_model=list[UserScriptMetaResponse])
def list_user_scripts() -> list[UserScriptMetaResponse]:
    return [_meta_response(item) for item in scripts_store.list_scripts()]


@router.post("", response_model=UserScriptMetaResponse)
def create_user_script(body: CreateUserScriptBody) -> UserScriptMetaResponse:
    try:
        meta = scripts_store.create_script(body.name, body.code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    refresh_user_script(meta.id)
    return _meta_response(meta)


@router.post("/{script_id}/versions", response_model=UserScriptMetaResponse)
def create_user_script_version(script_id: str, body: NewVersionBody) -> UserScriptMetaResponse:
    try:
        scripts_store.validate_script_id(script_id)
        meta = scripts_store.add_version(script_id, body.code)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    refresh_user_script(meta.id)
    return _meta_response(meta)


@router.get("/{script_id}/versions/{version}", response_model=UserScriptCodeResponse)
def get_user_script_version(script_id: str, version: int) -> UserScriptCodeResponse:
    try:
        scripts_store.validate_script_id(script_id)
        code = scripts_store.read_code(script_id, version)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserScriptCodeResponse(id=script_id, version=version, code=code)
