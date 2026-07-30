"""Collect Save Image outputs into a downloadable ZIP for the browser."""

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

DOWNLOAD_DIR = Path(__file__).resolve().parents[2] / "outputs" / "downloads"


@dataclass
class SaveBundle:
    """In-memory image files that will be zipped at the end of a run."""

    files: dict[str, bytes] = field(default_factory=dict)

    def add_image(self, name: str, image: np.ndarray) -> str:
        safe = Path(name).name or "image.png"
        suffix = Path(safe).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
            safe = f"{Path(safe).stem}.png"
            suffix = ".png"
        final_name = safe
        stem = Path(safe).stem
        file_suffix = Path(safe).suffix
        index = 2
        while final_name in self.files:
            final_name = f"{stem}_{index}{file_suffix}"
            index += 1
        encode_ext = ".jpg" if suffix in {".jpg", ".jpeg"} else suffix
        success, buffer = cv2.imencode(encode_ext, image)
        if not success:
            success, buffer = cv2.imencode(".png", image)
            final_name = f"{Path(final_name).stem}.png"
        if not success:
            raise RuntimeError(f"Failed to encode image for '{final_name}'")
        self.files[final_name] = buffer.tobytes()
        return final_name

    def write_zip(self, destination: Path | None = None) -> Path:
        if not self.files:
            raise ValueError("No images were saved")
        DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = destination or (DOWNLOAD_DIR / f"results_{stamp}_{uuid.uuid4().hex[:8]}.zip")
        out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, payload in self.files.items():
                archive.writestr(name, payload)
        return out.resolve()


current_save_bundle: ContextVar[SaveBundle | None] = ContextVar(
    "current_save_bundle",
    default=None,
)


def get_save_bundle() -> SaveBundle:
    bundle = current_save_bundle.get()
    if bundle is None:
        raise RuntimeError("Save bundle is not available for this run")
    return bundle


def zip_bytes(bundle: SaveBundle) -> bytes:
    """Return ZIP contents without writing to disk (tests / helpers)."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in bundle.files.items():
            archive.writestr(name, payload)
    return buffer.getvalue()
