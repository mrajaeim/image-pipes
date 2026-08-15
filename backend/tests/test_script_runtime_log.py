"""Tests for script_runtime log() helper."""

from __future__ import annotations

import numpy as np
import pytest

from app.engine.run_context import current_log_emit
from app.nodes.script_runtime import format_log_message, format_log_value, run_process_code


def test_format_log_value_ndarray() -> None:
    arr = np.zeros((4, 5, 3), dtype=np.uint8)
    assert format_log_value(arr) == "ndarray(shape=(4, 5, 3), dtype=uint8)"


def test_format_log_message_truncates_long_strings() -> None:
    message = format_log_message("x", "a" * 600)
    assert message.startswith("x ")
    assert message.endswith("…")
    assert len(message) < 520


def test_log_noop_without_emit() -> None:
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    code = """
def process(image, seed=0):
    log("hello", image)
    return image
"""
    result = run_process_code(code, image, seed=0)
    np.testing.assert_array_equal(result, image)


def test_log_calls_emit_with_formatted_message() -> None:
    image = np.ones((3, 3, 3), dtype=np.uint8)
    messages: list[str] = []
    token = current_log_emit.set(messages.append)
    try:
        code = """
def process(image, seed=0):
    log("start", image, 42)
    return image
"""
        run_process_code(code, image, seed=0)
    finally:
        current_log_emit.reset(token)

    assert messages == [
        "start ndarray(shape=(3, 3, 3), dtype=uint8) 42",
    ]


def test_log_during_process_failure_still_emitted() -> None:
    image = np.zeros((2, 2, 3), dtype=np.uint8)
    messages: list[str] = []
    token = current_log_emit.set(messages.append)
    try:
        code = """
def process(image, seed=0):
    log("before boom")
    raise RuntimeError("boom")
"""
        with pytest.raises(ValueError, match="boom"):
            run_process_code(code, image, seed=0)
    finally:
        current_log_emit.reset(token)

    assert messages == ["before boom"]
