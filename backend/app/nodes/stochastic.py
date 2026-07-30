"""Seeded stochastic image operations."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, number_param, require_image


class RandomBrightnessContrastNode(BaseNode):
    type = "random_brightness_contrast"
    label = "Random Brightness/Contrast"
    category = "stochastic"
    description = "Apply seeded random brightness and contrast jitter."
    ports = [image_in(), image_out()]
    stochastic = True
    params = [
        number_param("brightness", "Brightness Range", 30.0, minimum=0.0, maximum=100.0),
        number_param("contrast", "Contrast Range", 0.2, minimum=0.0, maximum=1.0, step=0.01),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        rng = np.random.default_rng(seed)
        image = require_image(inputs).astype(np.float32)
        brightness = float(params["brightness"])
        contrast = float(params["contrast"])
        delta_b = float(rng.uniform(-brightness, brightness))
        factor = float(rng.uniform(1.0 - contrast, 1.0 + contrast))
        result = np.clip(image * factor + delta_b, 0, 255).astype(np.uint8)
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        brightness = float(params["brightness"])
        return [
            "rng = np.random.default_rng(seed)",
            f"_img = {src}.astype(np.float32)",
            f"_b = float(rng.uniform(-{brightness}, {brightness}))",
            f"_c = float(rng.uniform(1.0 - {float(params['contrast'])}, "
            f"1.0 + {float(params['contrast'])}))",
            f"{dst} = np.clip(_img * _c + _b, 0, 255).astype(np.uint8)",
        ]


class GaussianNoiseNode(BaseNode):
    type = "gaussian_noise"
    label = "Gaussian Noise"
    category = "stochastic"
    description = "Add seeded Gaussian noise."
    ports = [image_in(), image_out()]
    stochastic = True
    params = [
        number_param("mean", "Mean", 0.0, minimum=-50.0, maximum=50.0),
        number_param("stddev", "Std Dev", 10.0, minimum=0.0, maximum=100.0),
    ]

    def execute(
        self,
        inputs: dict[str, np.ndarray | list[np.ndarray] | None],
        params: dict[str, Any],
        seed: int = 0,
    ) -> dict[str, np.ndarray | list[np.ndarray]]:
        rng = np.random.default_rng(seed)
        image = require_image(inputs).astype(np.float32)
        noise = rng.normal(float(params["mean"]), float(params["stddev"]), image.shape)
        result = np.clip(image + noise, 0, 255).astype(np.uint8)
        return {"image": result}

    def emit_python(
        self,
        node_id: str,
        params: dict[str, Any],
        input_vars: dict[str, str],
        output_vars: dict[str, str],
    ) -> list[str]:
        src = input_vars["image"]
        dst = output_vars["image"]
        return [
            "rng = np.random.default_rng(seed)",
            f"_noise = rng.normal({float(params['mean'])}, {float(params['stddev'])}, {src}.shape)",
            f"{dst} = np.clip({src}.astype(np.float32) + _noise, 0, 255).astype(np.uint8)",
        ]
