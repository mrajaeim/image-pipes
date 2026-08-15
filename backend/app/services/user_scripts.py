"""On-disk storage for versioned reusable user scripts."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.paths import user_scripts_dir

SCRIPT_ID_RE = re.compile(r"^script_(\d+)$")
USER_SCRIPT_TYPE_PREFIX = "user_script."
META_FILENAME = "meta.json"
PROCESS_FILENAME = "process.py"


@dataclass
class UserScriptMeta:
    id: str
    name: str
    current_version: int
    created_at: str
    updated_at: str

    def node_type(self) -> str:
        return f"{USER_SCRIPT_TYPE_PREFIX}{self.id}"


def is_user_script_type(node_type: str) -> bool:
    return node_type.startswith(USER_SCRIPT_TYPE_PREFIX)


def script_id_from_type(node_type: str) -> str | None:
    if not is_user_script_type(node_type):
        return None
    script_id = node_type[len(USER_SCRIPT_TYPE_PREFIX) :]
    return script_id if SCRIPT_ID_RE.match(script_id) else None


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _script_dir(script_id: str, root: Path | None = None) -> Path:
    return (root or user_scripts_dir()) / script_id


def _version_dir(script_id: str, version: int, root: Path | None = None) -> Path:
    return _script_dir(script_id, root) / f"v{version}"


def _meta_path(script_id: str, root: Path | None = None) -> Path:
    return _script_dir(script_id, root) / META_FILENAME


def validate_script_id(script_id: str) -> str:
    if not SCRIPT_ID_RE.match(script_id):
        raise ValueError(f"Invalid script id '{script_id}'")
    return script_id


def validate_display_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("Script name is required")
    if len(cleaned) > 80:
        raise ValueError("Script name must be at most 80 characters")
    return cleaned


def validate_process_code(code: str) -> str:
    """Compile-check that code defines a callable process()."""
    text = code if isinstance(code, str) else str(code)
    if not text.strip():
        raise ValueError("Script code is empty")
    try:
        compiled = compile(text, "<user_script>", "exec")
    except SyntaxError as exc:
        raise ValueError(f"Script syntax error: {exc}") from exc
    namespace: dict[str, Any] = {"__builtins__": __builtins__}
    exec(compiled, namespace, namespace)  # noqa: S102 — validation only
    process = namespace.get("process")
    if not callable(process):
        raise ValueError("Script must define a callable process(image, seed=0)")
    return text


def allocate_script_id(root: Path | None = None) -> str:
    base = root or user_scripts_dir()
    max_n = 0
    if base.is_dir():
        for child in base.iterdir():
            if not child.is_dir():
                continue
            match = SCRIPT_ID_RE.match(child.name)
            if match:
                max_n = max(max_n, int(match.group(1)))
    return f"script_{max_n + 1:03d}"


def read_meta(script_id: str, root: Path | None = None) -> UserScriptMeta:
    validate_script_id(script_id)
    path = _meta_path(script_id, root)
    if not path.is_file():
        raise FileNotFoundError(f"Unknown user script '{script_id}'")
    data = json.loads(path.read_text(encoding="utf-8"))
    return UserScriptMeta(
        id=str(data["id"]),
        name=str(data["name"]),
        current_version=int(data["current_version"]),
        created_at=str(data["created_at"]),
        updated_at=str(data["updated_at"]),
    )


def write_meta(meta: UserScriptMeta, root: Path | None = None) -> None:
    path = _meta_path(meta.id, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(meta), indent=2) + "\n", encoding="utf-8")


def read_code(script_id: str, version: int, root: Path | None = None) -> str:
    validate_script_id(script_id)
    if version < 1:
        raise ValueError("Version must be >= 1")
    path = _version_dir(script_id, version, root) / PROCESS_FILENAME
    if not path.is_file():
        raise FileNotFoundError(
            f"User script '{script_id}' version {version} not found"
        )
    return path.read_text(encoding="utf-8")


def write_code(script_id: str, version: int, code: str, root: Path | None = None) -> Path:
    validate_script_id(script_id)
    validated = validate_process_code(code)
    version_path = _version_dir(script_id, version, root)
    version_path.mkdir(parents=True, exist_ok=True)
    file_path = version_path / PROCESS_FILENAME
    file_path.write_text(validated, encoding="utf-8")
    return file_path


def list_scripts(root: Path | None = None) -> list[UserScriptMeta]:
    base = root or user_scripts_dir()
    items: list[UserScriptMeta] = []
    if not base.is_dir():
        return items
    for child in sorted(base.iterdir(), key=lambda p: p.name):
        if not child.is_dir() or not SCRIPT_ID_RE.match(child.name):
            continue
        meta_file = child / META_FILENAME
        if not meta_file.is_file():
            continue
        try:
            items.append(read_meta(child.name, root))
        except (OSError, KeyError, ValueError, json.JSONDecodeError):
            continue
    return items


def create_script(name: str, code: str, root: Path | None = None) -> UserScriptMeta:
    display = validate_display_name(name)
    validate_process_code(code)
    script_id = allocate_script_id(root)
    now = _now_iso()
    meta = UserScriptMeta(
        id=script_id,
        name=display,
        current_version=1,
        created_at=now,
        updated_at=now,
    )
    write_code(script_id, 1, code, root)
    write_meta(meta, root)
    return meta


def add_version(script_id: str, code: str, root: Path | None = None) -> UserScriptMeta:
    meta = read_meta(script_id, root)
    validate_process_code(code)
    next_version = meta.current_version + 1
    write_code(script_id, next_version, code, root)
    meta.current_version = next_version
    meta.updated_at = _now_iso()
    write_meta(meta, root)
    return meta
