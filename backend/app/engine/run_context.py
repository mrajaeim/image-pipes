"""Per-execution context for sample index and source filenames."""

from __future__ import annotations

from contextvars import ContextVar

current_sample_index: ContextVar[int] = ContextVar("current_sample_index", default=0)
current_source_stems: ContextVar[list[str]] = ContextVar(
    "current_source_stems",
    default=[],
)


def source_stem_for_sample(sample_index: int) -> str:
    stems = current_source_stems.get()
    if not stems:
        return "image"
    return stems[sample_index % len(stems)]
