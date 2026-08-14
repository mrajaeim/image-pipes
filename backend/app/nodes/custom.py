"""User-authored Python transform node (image in → image out)."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, require_image, string_param

DEFAULT_CUSTOM_CODE = """\
def process(image, seed=0):
    # image: BGR uint8 numpy array (H, W, C)
    # return: ndarray (same dtype preferred)
    return image
"""

CUSTOM_PYTHON_TYPE = "custom_python"


def graph_has_custom_python(nodes: list[Any]) -> bool:
    """True if any node instance is a custom_python node."""
    for node in nodes:
        node_type = node.type if hasattr(node, "type") else node.get("type")
        if node_type == CUSTOM_PYTHON_TYPE:
            return True
    return False


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
        if not code.strip():
            raise ValueError("Custom Python node has empty code")

        namespace: dict[str, Any] = {
            "__builtins__": __builtins__,
            "cv2": cv2,
            "np": np,
            "numpy": np,
        }
        try:
            compiled = compile(code, "<custom_python>", "exec")
            exec(compiled, namespace, namespace)  # noqa: S102 — intentional user code
        except SyntaxError as exc:
            raise ValueError(f"Custom Python syntax error: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Custom Python failed while loading: {exc}") from exc

        process = namespace.get("process")
        if not callable(process):
            raise ValueError("Custom Python code must define a callable process(image, seed=0)")

        try:
            result = process(image, seed=seed)
        except TypeError:
            try:
                result = process(image)
            except Exception as exc:  # noqa: BLE001
                raise ValueError(f"Custom Python process() failed: {exc}") from exc
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Custom Python process() failed: {exc}") from exc

        if not isinstance(result, np.ndarray):
            raise TypeError(
                f"Custom Python process() must return a numpy ndarray, got {type(result).__name__}"
            )
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
