"""Tests for content-addressed cache manager."""

from __future__ import annotations

import numpy as np

from app.engine.cache import CacheManager


def test_cache_put_get_roundtrip(tmp_path) -> None:
    cache = CacheManager(tmp_path)
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    image[:, :] = (10, 20, 30)
    key = cache.make_key("blur", {"k": 3}, {"image": cache.hash_image(image)}, seed=1)
    assert not cache.has(key)
    cache.put(key, image, meta={"node": "blur"})
    assert cache.has(key)
    loaded = cache.get(key)
    assert loaded is not None
    assert loaded.shape == image.shape
    assert np.array_equal(loaded, image)


def test_cache_key_changes_with_params(tmp_path) -> None:
    cache = CacheManager(tmp_path)
    inputs = {"image": "abc"}
    key_a = cache.make_key("blur", {"ksize": 3}, inputs, seed=0)
    key_b = cache.make_key("blur", {"ksize": 5}, inputs, seed=0)
    key_c = cache.make_key("blur", {"ksize": 3}, inputs, seed=1)
    assert key_a != key_b
    assert key_a != key_c
