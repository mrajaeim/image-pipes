"""Dynamic BaseNode factory for on-disk user scripts."""

from __future__ import annotations

from typing import Any

from app.engine.registry import BaseNode, registry
from app.nodes.common import image_in, image_out, int_param, require_image
from app.nodes.script_runtime import run_process_code
from app.services.user_scripts import (
    USER_SCRIPT_TYPE_PREFIX,
    UserScriptMeta,
    list_scripts,
    read_code,
    read_meta,
)


def _make_user_script_node(meta: UserScriptMeta) -> BaseNode:
    script_id = meta.id
    node_type = meta.node_type()
    display_name = meta.name
    default_version = max(1, int(meta.current_version))

    def execute(
        self: BaseNode,
        inputs: dict[str, Any],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, Any]:
        image = require_image(inputs)
        version = int(params.get("version") or default_version)
        code = read_code(script_id, version)
        result = run_process_code(
            code,
            image,
            seed=seed,
            source_name=f"<{script_id}.v{version}>",
        )
        return {"image": result}

    def emit_python(
        self: BaseNode,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        version = int(params.get("version") or default_version)
        code = read_code(script_id, version).rstrip()
        return [
            f"# --- {node_type} v{version}: {node_id} ---",
            *code.splitlines(),
            f"{output_vars['image']} = process({input_vars['image']}, seed=seed)",
            f"# --- end {node_type} ---",
        ]

    attrs: dict[str, Any] = {
        "type": node_type,
        "label": display_name,
        "category": "user_scripts",
        "description": (
            f"Reusable user script '{display_name}' ({script_id}). "
            "Code is loaded from app data; version is pinned on the canvas node."
        ),
        "ports": [image_in(), image_out()],
        "params": [
            int_param(
                "version",
                "Version",
                default_version,
                minimum=1,
                maximum=10_000,
                description="Pinned script version (older versions remain on disk).",
            ),
        ],
        "cacheable": True,
        "execute": execute,
        "emit_python": emit_python,
    }
    class_name = f"UserScript_{script_id}_Node"
    return type(class_name, (BaseNode,), attrs)()


def unregister_all_user_scripts() -> None:
    for node_type in list(registry._nodes.keys()):  # noqa: SLF001
        if node_type.startswith(USER_SCRIPT_TYPE_PREFIX):
            registry.unregister(node_type)


def register_user_scripts() -> None:
    """Load all on-disk user scripts into the global registry (replace existing)."""
    unregister_all_user_scripts()
    for meta in list_scripts():
        registry.replace(_make_user_script_node(meta))


def refresh_user_script(script_id: str) -> None:
    """Re-register a single script after create / new version."""
    meta = read_meta(script_id)
    registry.replace(_make_user_script_node(meta))
