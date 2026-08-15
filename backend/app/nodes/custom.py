"""User-authored Python transform node (image in → image out)."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, require_image, string_param
from app.nodes.script_runtime import run_process_code
from app.services.user_scripts import is_user_script_type

DEFAULT_CUSTOM_CODE = """\
def process(image, seed=0):
    # image: BGR uint8 numpy array (H, W, C)
    # return: ndarray (same dtype preferred)
    # Helpers: log(*args) — writes to Script log in the inspector
    return image
"""

CUSTOM_PYTHON_TYPE = "custom_python"


def graph_has_custom_code(nodes: list[Any]) -> bool:
    """True if any node runs user-authored Python (inline or reusable)."""
    for node in nodes:
        node_type = node.type if hasattr(node, "type") else node.get("type")
        if node_type == CUSTOM_PYTHON_TYPE or (
            isinstance(node_type, str) and is_user_script_type(node_type)
        ):
            return True
    return False


# Back-compat alias used by older imports/tests.
graph_has_custom_python = graph_has_custom_code


class CustomPythonNode(BaseNode):
    type = CUSTOM_PYTHON_TYPE
    label = "Custom Python"
    category = "script"
    description = (
        "Run your own Python transform. Define process(image, seed=0) and return a BGR ndarray. "
        "Code runs with full local privileges — only trust workflows you understand."
    )
    ports = [image_in(), image_out()]
    params = [
        string_param(
            "code",
            "Code",
            DEFAULT_CUSTOM_CODE,
            description="Python source that defines process(image, seed=0).",
        ),
    ]
    cacheable = True

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        image = require_image(inputs)
        code = str(params.get("code") or "")
        result = run_process_code(code, image, seed=seed, source_name="<custom_python>")
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        code = str(params.get("code") or DEFAULT_CUSTOM_CODE).rstrip()
        lines = [
            f"# --- custom_python: {node_id} ---",
            *code.splitlines(),
            f"{output_vars['image']} = process({input_vars['image']}, seed=seed)",
            f"# --- end custom_python: {node_id} ---",
        ]
        return lines
