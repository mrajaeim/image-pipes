"""Shared runtime for executing user process(image, seed=0) scripts."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.engine.run_context import current_log_emit

_MAX_LOG_ARG_CHARS = 500


def format_log_value(value: Any) -> str:
    """Pretty-print a value for script log() (ndarrays show shape/dtype)."""
    if isinstance(value, np.ndarray):
        return f"ndarray(shape={value.shape}, dtype={value.dtype})"
    if isinstance(value, str):
        text = value
    else:
        try:
            text = repr(value)
        except Exception:  # noqa: BLE001
            text = str(value)
    if len(text) > _MAX_LOG_ARG_CHARS:
        return f"{text[: _MAX_LOG_ARG_CHARS - 1]}…"
    return text


def format_log_message(*args: Any) -> str:
    return " ".join(format_log_value(arg) for arg in args)


def script_log(*args: Any) -> None:
    """Global helper injected into user scripts: log(*args) → Script log panel."""
    message = format_log_message(*args)
    emit = current_log_emit.get()
    if emit is not None:
        emit(message)


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
        "log": script_log,
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
