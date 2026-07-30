"""Content-addressed filesystem cache for intermediate images."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np


class CacheManager:
    """Stores and retrieves numpy images keyed by content hashes."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def hash_payload(payload: dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def hash_image(image: np.ndarray) -> str:
        digest = hashlib.sha256()
        digest.update(str(image.shape).encode("utf-8"))
        digest.update(str(image.dtype).encode("utf-8"))
        digest.update(np.ascontiguousarray(image).tobytes())
        return digest.hexdigest()

    def make_key(
        self,
        node_type: str,
        params: dict[str, Any],
        input_hashes: dict[str, str],
        seed: int,
    ) -> str:
        return self.hash_payload(
            {
                "node_type": node_type,
                "params": params,
                "inputs": input_hashes,
                "seed": seed,
            }
        )

    def _paths(self, key: str) -> tuple[Path, Path]:
        base = self.root / key[:2] / key
        return base.with_suffix(".png"), base.with_suffix(".json")

    def get(self, key: str) -> np.ndarray | None:
        image_path, meta_path = self._paths(key)
        if not image_path.exists() or not meta_path.exists():
            return None
        image = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
        return image

    def put(self, key: str, image: np.ndarray, meta: dict[str, Any] | None = None) -> None:
        image_path, meta_path = self._paths(key)
        image_path.parent.mkdir(parents=True, exist_ok=True)
        ok = cv2.imwrite(str(image_path), image)
        if not ok:
            raise RuntimeError(f"Failed to write cache image for key {key}")
        payload = {"key": key, **(meta or {})}
        meta_path.write_text(json.dumps(payload), encoding="utf-8")

    def has(self, key: str) -> bool:
        image_path, meta_path = self._paths(key)
        return image_path.exists() and meta_path.exists()

    def clear(self) -> None:
        for path in self.root.rglob("*"):
            if path.is_file() and path.name != ".gitkeep":
                path.unlink()
