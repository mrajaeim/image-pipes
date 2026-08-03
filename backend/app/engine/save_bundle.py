"""Collect Save Image outputs into ZIP archives under the output folder."""

from __future__ import annotations

import io
import uuid
import zipfile
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from app.paths import output_dir

OUTPUT_DIR = output_dir()


def _unique_name(existing: dict[str, bytes], name: str) -> str:
    safe = Path(name).name or "image.png"
    suffix = Path(safe).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
        safe = f"{Path(safe).stem}.png"
    final_name = safe
    stem = Path(safe).stem
    file_suffix = Path(safe).suffix
    index = 2
    while final_name in existing:
        final_name = f"{stem}_{index}{file_suffix}"
        index += 1
    return final_name


@dataclass
class SaveBundle:
    """In-memory image files grouped by destination directory for ZIP writes."""

    files_by_dest: dict[str, dict[str, bytes]] = field(default_factory=dict)

    @property
    def files(self) -> dict[str, bytes]:
        """Flattened view of all pending ZIP entries (tests / legacy checks)."""
        merged: dict[str, bytes] = {}
        for bucket in self.files_by_dest.values():
            merged.update(bucket)
        return merged

    def add_image(
        self,
        name: str,
        image: np.ndarray,
        destination: Path | None = None,
    ) -> str:
        dest_key = str((destination or OUTPUT_DIR).resolve())
        bucket = self.files_by_dest.setdefault(dest_key, {})
        final_name = _unique_name(bucket, name)
        suffix = Path(final_name).suffix.lower()
        encode_ext = ".jpg" if suffix in {".jpg", ".jpeg"} else suffix
        success, buffer = cv2.imencode(encode_ext, image)
        if not success:
            success, buffer = cv2.imencode(".png", image)
            final_name = f"{Path(final_name).stem}.png"
        if not success:
            raise RuntimeError(f"Failed to encode image for '{final_name}'")
        bucket[final_name] = buffer.tobytes()
        return final_name

    def write_zips(self) -> list[Path]:
        """Write one ZIP per destination directory; return written paths."""
        if not self.files_by_dest:
            raise ValueError("No images were saved")
        written: list[Path] = []
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        for dest_key, files in self.files_by_dest.items():
            if not files:
                continue
            dest = Path(dest_key)
            dest.mkdir(parents=True, exist_ok=True)
            out = dest / f"results_{stamp}_{uuid.uuid4().hex[:8]}.zip"
            with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for name, payload in files.items():
                    archive.writestr(name, payload)
            written.append(out.resolve())
        if not written:
            raise ValueError("No images were saved")
        return written

    def write_zip(self, destination: Path | None = None) -> Path:
        """Write a single ZIP (tests / helpers). Uses destination or first bucket."""
        if destination is not None:
            dest_key = str(destination.resolve())
            files = self.files_by_dest.get(dest_key) or self.files
            if not files:
                raise ValueError("No images were saved")
            destination.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            out = destination / f"results_{stamp}_{uuid.uuid4().hex[:8]}.zip"
            with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for name, payload in files.items():
                    archive.writestr(name, payload)
            return out.resolve()
        paths = self.write_zips()
        return paths[0]


@dataclass
class FolderSaveTracker:
    """Tracks directories written by Save Image when writing bare files."""

    directories: set[str] = field(default_factory=set)
    files: list[str] = field(default_factory=list)

    def record(self, path: Path) -> None:
        resolved = path.resolve()
        self.files.append(str(resolved))
        self.directories.add(str(resolved.parent))


current_save_bundle: ContextVar[SaveBundle | None] = ContextVar(
    "current_save_bundle",
    default=None,
)

current_folder_saves: ContextVar[FolderSaveTracker | None] = ContextVar(
    "current_folder_saves",
    default=None,
)


def get_save_bundle() -> SaveBundle:
    bundle = current_save_bundle.get()
    if bundle is None:
        raise RuntimeError("Save bundle is not available for this run")
    return bundle


def get_folder_saves() -> FolderSaveTracker:
    tracker = current_folder_saves.get()
    if tracker is None:
        raise RuntimeError("Folder save tracker is not available for this run")
    return tracker


def zip_bytes(bundle: SaveBundle) -> bytes:
    """Return ZIP contents without writing to disk (tests / helpers)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in bundle.files.items():
            archive.writestr(name, payload)
    return buffer.getvalue()
