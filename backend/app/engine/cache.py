"""Content-addressed filesystem cache for intermediate images and annotations."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np


def is_image_value(value: Any) -> bool:
    """Return True when value is an ndarray or a non-empty list of ndarrays."""
    if isinstance(value, np.ndarray):
        return True
    if isinstance(value, list) and value and all(isinstance(item, np.ndarray) for item in value):
        return True
    return False


class CacheManager:
    """Stores and retrieves numpy images and JSON annotation payloads."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def hash_payload(payload: Any) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    @staticmethod
    def hash_image(image: np.ndarray) -> str:
        digest = hashlib.sha256()
        digest.update(str(image.shape).encode("utf-8"))
        digest.update(str(image.dtype).encode("utf-8"))
        digest.update(np.ascontiguousarray(image).tobytes())
        return digest.hexdigest()

    def hash_value(self, value: Any) -> str:
        if value is None:
            return "none"
        if isinstance(value, np.ndarray):
            return self.hash_image(value)
        if isinstance(value, list) and value and all(
            isinstance(item, np.ndarray) for item in value
        ):
            return self.hash_payload([self.hash_image(item) for item in value])
        return self.hash_payload(value)

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

    def _base(self, key: str) -> Path:
        return self.root / key[:2] / key

    def _paths(self, key: str) -> tuple[Path, Path]:
        base = self._base(key)
        return base.with_suffix(".png"), base.with_suffix(".json")

    def _port_path(self, key: str, port: str) -> Path:
        return self._base(key).parent / f"{key}__{port}.png"

    def _annotation_path(self, key: str, port: str) -> Path:
        return self._base(key).parent / f"{key}__{port}.json"

    def get(self, key: str) -> np.ndarray | None:
        image_path, meta_path = self._paths(key)
        if not image_path.exists() or not meta_path.exists():
            return None
        return cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)

    def put(self, key: str, image: np.ndarray, meta: dict[str, Any] | None = None) -> None:
        image_path, meta_path = self._paths(key)
        image_path.parent.mkdir(parents=True, exist_ok=True)
        ok = cv2.imwrite(str(image_path), image)
        if not ok:
            raise RuntimeError(f"Failed to write cache image for key {key}")
        payload = {"key": key, "ports": ["image"], **(meta or {})}
        meta_path.write_text(json.dumps(payload), encoding="utf-8")

    def has(self, key: str) -> bool:
        return self.has_outputs(key)

    def put_outputs(
        self,
        key: str,
        outputs: dict[str, Any],
        meta: dict[str, Any] | None = None,
    ) -> None:
        normalized: dict[str, np.ndarray] = {}
        list_ports: dict[str, int] = {}
        annotations: dict[str, Any] = {}

        for port, value in outputs.items():
            if isinstance(value, np.ndarray):
                normalized[port] = value
            elif isinstance(value, list) and value and all(
                isinstance(item, np.ndarray) for item in value
            ):
                list_ports[port] = len(value)
                for index, image in enumerate(value):
                    normalized[f"{port}#{index}"] = image
            else:
                annotations[port] = value

        if not normalized and not annotations:
            raise ValueError(f"No outputs to cache for key {key}")

        base = self._base(key)
        base.parent.mkdir(parents=True, exist_ok=True)
        for port, image in normalized.items():
            path = self._port_path(key, port)
            if not cv2.imwrite(str(path), image):
                raise RuntimeError(f"Failed to write cache image for key {key} port {port}")

        for port, payload in annotations.items():
            path = self._annotation_path(key, port)
            path.write_text(json.dumps(payload), encoding="utf-8")

        if "image" in normalized and len(normalized) == 1 and not annotations:
            legacy, _ = self._paths(key)
            cv2.imwrite(str(legacy), normalized["image"])

        meta_payload = {
            "key": key,
            "ports": sorted(normalized.keys()),
            "list_ports": list_ports,
            "annotation_ports": sorted(annotations.keys()),
            **(meta or {}),
        }
        base.with_suffix(".json").write_text(json.dumps(meta_payload), encoding="utf-8")

    def get_outputs(self, key: str) -> dict[str, Any] | None:
        _, meta_path = self._paths(key)
        if not meta_path.exists():
            return None
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        ports = meta.get("ports") or []
        list_ports = meta.get("list_ports") or {}
        annotation_ports = meta.get("annotation_ports") or []
        if not ports and not annotation_ports:
            image = self.get(key)
            return {"image": image} if image is not None else None

        flat: dict[str, np.ndarray] = {}
        for port in ports:
            path = self._port_path(key, port)
            if not path.exists() and port == "image":
                legacy, _ = self._paths(key)
                path = legacy
            if not path.exists():
                return None
            image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
            if image is None:
                return None
            flat[port] = image

        outputs: dict[str, Any] = {}
        consumed: set[str] = set()
        for port, count in list_ports.items():
            items: list[np.ndarray] = []
            for index in range(count):
                item_key = f"{port}#{index}"
                if item_key not in flat:
                    return None
                items.append(flat[item_key])
                consumed.add(item_key)
            outputs[port] = items
        for port, image in flat.items():
            if port not in consumed:
                outputs[port] = image

        for port in annotation_ports:
            path = self._annotation_path(key, port)
            if not path.exists():
                return None
            outputs[port] = json.loads(path.read_text(encoding="utf-8"))

        return outputs

    def has_outputs(self, key: str) -> bool:
        return self.get_outputs(key) is not None

    def clear(self) -> None:
        for path in self.root.rglob("*"):
            if path.is_file() and path.name != ".gitkeep":
                path.unlink()
