"""Per-execution context for sample index and source filenames."""

from __future__ import annotations

from collections.abc import Callable
from contextvars import ContextVar

current_sample_index: ContextVar[int] = ContextVar("current_sample_index", default=0)
current_source_stems: ContextVar[list[str]] = ContextVar(
    "current_source_stems",
    default=[],
)
current_node_id: ContextVar[str | None] = ContextVar("current_node_id", default=None)
# Optional sink for script log() lines (set by DagExecutor during node execute).
current_log_emit: ContextVar[Callable[[str], None] | None] = ContextVar(
    "current_log_emit",
    default=None,
)


def source_stem_for_sample(sample_index: int) -> str:
    stems = current_source_stems.get()
    if not stems:
        return "image"
    return stems[sample_index % len(stems)]
