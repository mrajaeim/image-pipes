"""Schemas for registered image assets (desktop paths or staged uploads)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AssetKind = Literal["external", "staged", "folder"]


class AssetFile(BaseModel):
    """One image in a batch. `path` is absolute on the local machine."""

    name: str
    path: str


class AssetBatch(BaseModel):
    id: str
    kind: AssetKind
    files: list[AssetFile] = Field(default_factory=list)
    """Directory root when kind is folder, else parent of the first file."""
    root: str | None = None


class RegisterAssetsRequest(BaseModel):
    """Register local filesystem paths without copying (desktop pickers)."""

    paths: list[str] = Field(default_factory=list)
    as_folder: bool = False
    append_to: str | None = None


class RegisterAssetsResponse(BaseModel):
    batch: AssetBatch
    count: int


class AssetPreviewInfo(BaseModel):
    batch_id: str
    name: str
    preview_url: str
