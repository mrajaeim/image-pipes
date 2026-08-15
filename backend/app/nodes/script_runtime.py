"""Shared runtime for executing user process(image, seed=0) scripts."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def run_process_code(
    code: str,
    image: np.ndarray,
    seed: int = 0,
    *,
    source_name: str = "<user_script>",
) -> np.ndarray:
    """Execute user process(image, seed=0) and validate the return value."""
    if not code.strip():
        raise ValueError("Script code is empty")
    namespace: dict[str, Any] = {
        "__builtins__": __builtins__,
        "cv2": cv2,
        "np": np,
        "numpy": np,
    }
    try:
        compiled = compile(code, source_name, "exec")
        exec(compiled, namespace, namespace)  # noqa: S102 — intentional user code
    except SyntaxError as exc:
        raise ValueError(f"Script syntax error: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Script failed while loading: {exc}") from exc

    process = namespace.get("process")
    if not callable(process):
        raise ValueError("Script must define a callable process(image, seed=0)")

    try:
        result = process(image, seed=seed)
    except TypeError:
        try:
            result = process(image)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Script process() failed: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Script process() failed: {exc}") from exc

    if not isinstance(result, np.ndarray):
        raise TypeError(
            f"Script process() must return a numpy ndarray, got {type(result).__name__}"
        )
    return result
