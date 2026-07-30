"""Catalog of Albumentations transforms exposed as Image Pipes nodes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(frozen=True)
class AlbuParam:
    name: str
    label: str
    kind: Literal["number", "integer", "select", "boolean", "range"]
    default: Any
    minimum: float | None = None
    maximum: float | None = None
    step: float | None = None
    options: tuple[str, ...] | None = None
    description: str | None = None
    # When set, maps UI value into transform kwargs under this key.
    albu_key: str | None = None


@dataclass(frozen=True)
class AlbuEntry:
    class_name: str
    node_type: str
    label: str
    family: str
    targets: Literal["image_only", "dual"]
    description: str
    params: tuple[AlbuParam, ...] = field(default_factory=tuple)


def _p(default: float = 0.5) -> AlbuParam:
    return AlbuParam(
        "p",
        "Probability",
        "number",
        default,
        minimum=0.0,
        maximum=1.0,
        step=0.05,
        description="Chance the transform is applied",
    )


def _range(
    name: str,
    label: str,
    default: float,
    minimum: float = 0.0,
    maximum: float = 1.0,
    step: float = 0.01,
    description: str | None = None,
    albu_key: str | None = None,
) -> AlbuParam:
    return AlbuParam(
        name,
        label,
        "range",
        default,
        minimum=minimum,
        maximum=maximum,
        step=step,
        description=description or f"Symmetric limit → (-v, +v) for {albu_key or name}",
        albu_key=albu_key or name,
    )


def _num(
    name: str,
    label: str,
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
    step: float | None = 0.01,
    description: str | None = None,
    albu_key: str | None = None,
) -> AlbuParam:
    return AlbuParam(
        name,
        label,
        "number",
        default,
        minimum=minimum,
        maximum=maximum,
        step=step,
        description=description,
        albu_key=albu_key,
    )


def _int(
    name: str,
    label: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
    description: str | None = None,
    albu_key: str | None = None,
) -> AlbuParam:
    return AlbuParam(
        name,
        label,
        "integer",
        default,
        minimum=minimum,
        maximum=maximum,
        step=1,
        description=description,
        albu_key=albu_key,
    )


def _sel(
    name: str,
    label: str,
    default: str,
    options: tuple[str, ...],
    description: str | None = None,
    albu_key: str | None = None,
) -> AlbuParam:
    return AlbuParam(
        name,
        label,
        "select",
        default,
        options=options,
        description=description,
        albu_key=albu_key,
    )


def _bool(
    name: str,
    label: str,
    default: bool,
    description: str | None = None,
    albu_key: str | None = None,
) -> AlbuParam:
    return AlbuParam(
        name,
        label,
        "boolean",
        default,
        description=description,
        albu_key=albu_key,
    )


# ---------------------------------------------------------------------------
# Color / pixel (ImageOnly)
# ---------------------------------------------------------------------------
COLOR_ENTRIES: tuple[AlbuEntry, ...] = (
    AlbuEntry(
        "RandomBrightnessContrast",
        "albu_random_brightness_contrast",
        "Albu Brightness/Contrast",
        "color",
        "image_only",
        "Random brightness and contrast jitter (Albumentations).",
        (
            _range("brightness_limit", "Brightness Limit", 0.2, 0.0, 1.0),
            _range("contrast_limit", "Contrast Limit", 0.2, 0.0, 1.0),
            _bool("brightness_by_max", "Brightness By Max", True),
            _p(),
        ),
    ),
    AlbuEntry(
        "HueSaturationValue",
        "albu_hue_saturation_value",
        "Albu Hue/Saturation/Value",
        "color",
        "image_only",
        "Random HSV shifts.",
        (
            _range("hue_shift_limit", "Hue Shift", 20, 0, 100, 1),
            _range("sat_shift_limit", "Saturation Shift", 30, 0, 100, 1),
            _range("val_shift_limit", "Value Shift", 20, 0, 100, 1),
            _p(),
        ),
    ),
    AlbuEntry(
        "RGBShift",
        "albu_rgb_shift",
        "Albu RGB Shift",
        "color",
        "image_only",
        "Independently shift R/G/B channels.",
        (
            _range("r_shift_limit", "R Shift", 20, 0, 100, 1),
            _range("g_shift_limit", "G Shift", 20, 0, 100, 1),
            _range("b_shift_limit", "B Shift", 20, 0, 100, 1),
            _p(),
        ),
    ),
    AlbuEntry(
        "ColorJitter",
        "albu_color_jitter",
        "Albu Color Jitter",
        "color",
        "image_only",
        "Jitter brightness, contrast, saturation, and hue.",
        (
            _num("brightness", "Brightness", 0.2, 0.0, 1.0, 0.01),
            _num("contrast", "Contrast", 0.2, 0.0, 1.0, 0.01),
            _num("saturation", "Saturation", 0.2, 0.0, 1.0, 0.01),
            _num("hue", "Hue", 0.1, 0.0, 0.5, 0.01),
            _p(),
        ),
    ),
    AlbuEntry(
        "CLAHE",
        "albu_clahe",
        "Albu CLAHE",
        "color",
        "image_only",
        "Contrast Limited Adaptive Histogram Equalization.",
        (
            _num("clip_limit", "Clip Limit", 4.0, 1.0, 40.0, 0.5),
            _int("tile_grid_size", "Tile Grid Size", 8, 1, 32, "Square tile grid size"),
            _p(),
        ),
    ),
    AlbuEntry(
        "Equalize",
        "albu_equalize",
        "Albu Equalize",
        "color",
        "image_only",
        "Histogram equalization.",
        (
            _sel("mode", "Mode", "cv", ("cv", "pil")),
            _bool("by_channels", "By Channels", True),
            _p(),
        ),
    ),
    AlbuEntry(
        "RandomGamma",
        "albu_random_gamma",
        "Albu Random Gamma",
        "color",
        "image_only",
        "Apply a random gamma transform.",
        (
            _num("gamma_min", "Gamma Min", 80, 10, 200, 1),
            _num("gamma_max", "Gamma Max", 120, 10, 200, 1),
            _p(),
        ),
    ),
    AlbuEntry(
        "RandomToneCurve",
        "albu_random_tone_curve",
        "Albu Random Tone Curve",
        "color",
        "image_only",
        "Random tone curve adjustment.",
        (_num("scale", "Scale", 0.1, 0.0, 1.0, 0.01), _p()),
    ),
    AlbuEntry(
        "Posterize",
        "albu_posterize",
        "Albu Posterize",
        "color",
        "image_only",
        "Reduce the number of bits per channel.",
        (_int("num_bits", "Num Bits", 4, 1, 8), _p()),
    ),
    AlbuEntry(
        "Solarize",
        "albu_solarize",
        "Albu Solarize",
        "color",
        "image_only",
        "Invert all pixels above a threshold.",
        (
            _num("threshold_min", "Threshold Min", 0.5, 0.0, 1.0, 0.05),
            _num("threshold_max", "Threshold Max", 0.5, 0.0, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "InvertImg",
        "albu_invert_img",
        "Albu Invert",
        "color",
        "image_only",
        "Invert image pixel values.",
        (_p(1.0),),
    ),
    AlbuEntry(
        "ToGray",
        "albu_to_gray",
        "Albu To Gray",
        "color",
        "image_only",
        "Convert image to grayscale (kept as 3-channel by Albumentations).",
        (_p(1.0),),
    ),
    AlbuEntry(
        "ToSepia",
        "albu_to_sepia",
        "Albu To Sepia",
        "color",
        "image_only",
        "Apply a sepia filter.",
        (_p(1.0),),
    ),
    AlbuEntry(
        "ToRGB",
        "albu_to_rgb",
        "Albu To RGB",
        "color",
        "image_only",
        "Convert grayscale to RGB.",
        (_p(1.0),),
    ),
    AlbuEntry(
        "FancyPCA",
        "albu_fancy_pca",
        "Albu Fancy PCA",
        "color",
        "image_only",
        "PCA color augmentation (Krizhevsky-style).",
        (_num("alpha", "Alpha", 0.1, 0.0, 1.0, 0.01), _p()),
    ),
    AlbuEntry(
        "PlanckianJitter",
        "albu_planckian_jitter",
        "Albu Planckian Jitter",
        "color",
        "image_only",
        "Physically based color temperature jitter.",
        (
            _sel("mode", "Mode", "blackbody", ("blackbody", "cietype")),
            _p(),
        ),
    ),
    AlbuEntry(
        "Sharpen",
        "albu_sharpen",
        "Albu Sharpen",
        "color",
        "image_only",
        "Sharpen the input image.",
        (
            _num("alpha_min", "Alpha Min", 0.2, 0.0, 1.0, 0.05),
            _num("alpha_max", "Alpha Max", 0.5, 0.0, 1.0, 0.05),
            _num("lightness_min", "Lightness Min", 0.5, 0.0, 1.0, 0.05),
            _num("lightness_max", "Lightness Max", 1.0, 0.0, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "Emboss",
        "albu_emboss",
        "Albu Emboss",
        "color",
        "image_only",
        "Emboss the input image.",
        (
            _num("alpha_min", "Alpha Min", 0.2, 0.0, 1.0, 0.05),
            _num("alpha_max", "Alpha Max", 0.5, 0.0, 1.0, 0.05),
            _num("strength_min", "Strength Min", 0.2, 0.0, 1.0, 0.05),
            _num("strength_max", "Strength Max", 0.7, 0.0, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "AutoContrast",
        "albu_auto_contrast",
        "Albu Auto Contrast",
        "color",
        "image_only",
        "Maximize image contrast.",
        (_p(1.0),),
    ),
)


# ---------------------------------------------------------------------------
# Blur / noise (ImageOnly)
# ---------------------------------------------------------------------------
BLUR_NOISE_ENTRIES: tuple[AlbuEntry, ...] = (
    AlbuEntry(
        "Blur",
        "albu_blur",
        "Albu Blur",
        "blur",
        "image_only",
        "Random blur with a square kernel.",
        (_int("blur_limit", "Blur Limit", 7, 3, 15), _p()),
    ),
    AlbuEntry(
        "GaussianBlur",
        "albu_gaussian_blur",
        "Albu Gaussian Blur",
        "blur",
        "image_only",
        "Apply Gaussian blur.",
        (_int("blur_limit", "Blur Limit", 7, 3, 15), _p()),
    ),
    AlbuEntry(
        "MotionBlur",
        "albu_motion_blur",
        "Albu Motion Blur",
        "blur",
        "image_only",
        "Apply motion blur.",
        (_int("blur_limit", "Blur Limit", 7, 3, 15), _p()),
    ),
    AlbuEntry(
        "MedianBlur",
        "albu_median_blur",
        "Albu Median Blur",
        "blur",
        "image_only",
        "Apply median blur.",
        (_int("blur_limit", "Blur Limit", 7, 3, 15), _p()),
    ),
    AlbuEntry(
        "GlassBlur",
        "albu_glass_blur",
        "Albu Glass Blur",
        "blur",
        "image_only",
        "Glass blur distortion.",
        (
            _num("sigma", "Sigma", 0.7, 0.0, 2.0, 0.05),
            _num("max_delta", "Max Delta", 4, 1, 10, 1),
            _int("iterations", "Iterations", 2, 1, 5),
            _p(),
        ),
    ),
    AlbuEntry(
        "AdvancedBlur",
        "albu_advanced_blur",
        "Albu Advanced Blur",
        "blur",
        "image_only",
        "Generalized blur with random kernels.",
        (_p(),),
    ),
    AlbuEntry(
        "Defocus",
        "albu_defocus",
        "Albu Defocus",
        "blur",
        "image_only",
        "Simulate defocus blur.",
        (
            _int("radius", "Radius", 3, 1, 10),
            _num("alias_blur", "Alias Blur", 0.1, 0.0, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "ZoomBlur",
        "albu_zoom_blur",
        "Albu Zoom Blur",
        "blur",
        "image_only",
        "Apply zoom blur.",
        (_p(),),
    ),
    AlbuEntry(
        "GaussNoise",
        "albu_gauss_noise",
        "Albu Gauss Noise",
        "noise",
        "image_only",
        "Apply Gaussian noise.",
        (
            _num("std_min", "Std Min", 0.2, 0.0, 1.0, 0.01, albu_key="std_range"),
            _num("std_max", "Std Max", 0.44, 0.0, 1.0, 0.01, albu_key="std_range"),
            _bool("per_channel", "Per Channel", True),
            _p(),
        ),
    ),
    AlbuEntry(
        "ISONoise",
        "albu_iso_noise",
        "Albu ISO Noise",
        "noise",
        "image_only",
        "Apply camera ISO-like noise.",
        (
            _num("color_shift_min", "Color Shift Min", 0.01, 0.0, 1.0, 0.01),
            _num("color_shift_max", "Color Shift Max", 0.05, 0.0, 1.0, 0.01),
            _num("intensity_min", "Intensity Min", 0.1, 0.0, 1.0, 0.01),
            _num("intensity_max", "Intensity Max", 0.5, 0.0, 1.0, 0.01),
            _p(),
        ),
    ),
    AlbuEntry(
        "MultiplicativeNoise",
        "albu_multiplicative_noise",
        "Albu Multiplicative Noise",
        "noise",
        "image_only",
        "Multiply image by random noise.",
        (
            _num("multiplier_min", "Multiplier Min", 0.9, 0.1, 2.0, 0.01),
            _num("multiplier_max", "Multiplier Max", 1.1, 0.1, 2.0, 0.01),
            _bool("per_channel", "Per Channel", True),
            _p(),
        ),
    ),
    AlbuEntry(
        "SaltAndPepper",
        "albu_salt_and_pepper",
        "Albu Salt And Pepper",
        "noise",
        "image_only",
        "Add salt-and-pepper noise.",
        (
            _num("amount_min", "Amount Min", 0.01, 0.0, 0.5, 0.01),
            _num("amount_max", "Amount Max", 0.06, 0.0, 0.5, 0.01),
            _num("salt_min", "Salt Ratio Min", 0.4, 0.0, 1.0, 0.05),
            _num("salt_max", "Salt Ratio Max", 0.6, 0.0, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "ImageCompression",
        "albu_image_compression",
        "Albu Image Compression",
        "noise",
        "image_only",
        "Simulate JPEG/WebP compression artifacts.",
        (
            _int("quality_lower", "Quality Lower", 50, 1, 100),
            _int("quality_upper", "Quality Upper", 100, 1, 100),
            _sel(
                "compression_type",
                "Compression Type",
                "jpeg",
                ("jpeg", "webp"),
            ),
            _p(),
        ),
    ),
    AlbuEntry(
        "Downscale",
        "albu_downscale",
        "Albu Downscale",
        "noise",
        "image_only",
        "Downscale then upscale to degrade resolution.",
        (
            _num("scale_min", "Scale Min", 0.25, 0.05, 1.0, 0.05),
            _num("scale_max", "Scale Max", 0.5, 0.05, 1.0, 0.05),
            _p(),
        ),
    ),
    AlbuEntry(
        "RingingOvershoot",
        "albu_ringing_overshoot",
        "Albu Ringing Overshoot",
        "noise",
        "image_only",
        "Simulate ringing / overshoot artifacts.",
        (_p(),),
    ),
)


# ---------------------------------------------------------------------------
# Weather / illumination (ImageOnly)
# ---------------------------------------------------------------------------
WEATHER_ENTRIES: tuple[AlbuEntry, ...] = (
    AlbuEntry(
        "RandomFog",
        "albu_random_fog",
        "Albu Random Fog",
        "weather",
        "image_only",
        "Add fog to the image.",
        (
            _num("fog_coef_min", "Fog Coef Min", 0.3, 0.0, 1.0, 0.05),
            _num("fog_coef_max", "Fog Coef Max", 1.0, 0.0, 1.0, 0.05),
            _num("alpha_coef", "Alpha Coef", 0.08, 0.0, 1.0, 0.01),
            _p(),
        ),
    ),
    AlbuEntry(
        "RandomRain",
        "albu_random_rain",
        "Albu Random Rain",
        "weather",
        "image_only",
        "Add rain streaks.",
        (_p(),),
    ),
    AlbuEntry(
        "RandomSnow",
        "albu_random_snow",
        "Albu Random Snow",
        "weather",
        "image_only",
        "Add snow.",
        (_p(),),
    ),
    AlbuEntry(
        "RandomSunFlare",
        "albu_random_sun_flare",
        "Albu Random Sun Flare",
        "weather",
        "image_only",
        "Add a sun flare effect.",
        (_p(),),
    ),
    AlbuEntry(
        "RandomShadow",
        "albu_random_shadow",
        "Albu Random Shadow",
        "weather",
        "image_only",
        "Add random shadows.",
        (_p(),),
    ),
    AlbuEntry(
        "RandomGravel",
        "albu_random_gravel",
        "Albu Random Gravel",
        "weather",
        "image_only",
        "Add gravel-like noise patches.",
        (_p(),),
    ),
    AlbuEntry(
        "Spatter",
        "albu_spatter",
        "Albu Spatter",
        "weather",
        "image_only",
        "Simulate rain / mud spatter.",
        (_p(),),
    ),
    AlbuEntry(
        "Illumination",
        "albu_illumination",
        "Albu Illumination",
        "weather",
        "image_only",
        "Non-uniform illumination change.",
        (_p(),),
    ),
    AlbuEntry(
        "PlasmaBrightnessContrast",
        "albu_plasma_brightness_contrast",
        "Albu Plasma Brightness/Contrast",
        "weather",
        "image_only",
        "Plasma-noise based brightness/contrast.",
        (_p(),),
    ),
    AlbuEntry(
        "PlasmaShadow",
        "albu_plasma_shadow",
        "Albu Plasma Shadow",
        "weather",
        "image_only",
        "Plasma-noise based shadows.",
        (_p(),),
    ),
    AlbuEntry(
        "ChromaticAberration",
        "albu_chromatic_aberration",
        "Albu Chromatic Aberration",
        "weather",
        "image_only",
        "Simulate chromatic aberration.",
        (_p(),),
    ),
)


# ---------------------------------------------------------------------------
# Normalize / channels / dropout (ImageOnly)
# ---------------------------------------------------------------------------
NORMALIZE_CHANNEL_ENTRIES: tuple[AlbuEntry, ...] = (
    AlbuEntry(
        "Normalize",
        "albu_normalize",
        "Albu Normalize",
        "normalize",
        "image_only",
        "Normalize pixels (float). Remapped to uint8 for previews.",
        (
            _num("mean_r", "Mean R", 0.485, 0.0, 1.0, 0.001),
            _num("mean_g", "Mean G", 0.456, 0.0, 1.0, 0.001),
            _num("mean_b", "Mean B", 0.406, 0.0, 1.0, 0.001),
            _num("std_r", "Std R", 0.229, 0.0, 1.0, 0.001),
            _num("std_g", "Std G", 0.224, 0.0, 1.0, 0.001),
            _num("std_b", "Std B", 0.225, 0.0, 1.0, 0.001),
            _num("max_pixel_value", "Max Pixel Value", 255.0, 1.0, 255.0, 1.0),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "ChannelShuffle",
        "albu_channel_shuffle",
        "Albu Channel Shuffle",
        "channels",
        "image_only",
        "Randomly rearrange color channels.",
        (_p(),),
    ),
    AlbuEntry(
        "ChannelDropout",
        "albu_channel_dropout",
        "Albu Channel Dropout",
        "channels",
        "image_only",
        "Drop random channels.",
        (
            _int("channel_drop_min", "Drop Min", 1, 1, 2),
            _int("channel_drop_max", "Drop Max", 1, 1, 2),
            _num("fill", "Fill Value", 0, 0, 255, 1),
            _p(),
        ),
    ),
    AlbuEntry(
        "ToFloat",
        "albu_to_float",
        "Albu To Float",
        "normalize",
        "image_only",
        "Divide by max_value (float). Remapped to uint8 for previews.",
        (_num("max_value", "Max Value", 255.0, 1.0, 255.0, 1.0), _p(1.0)),
    ),
    AlbuEntry(
        "FromFloat",
        "albu_from_float",
        "Albu From Float",
        "normalize",
        "image_only",
        "Multiply float image back toward uint8 range.",
        (_num("max_value", "Max Value", 255.0, 1.0, 255.0, 1.0), _p(1.0)),
    ),
    AlbuEntry(
        "PixelDropout",
        "albu_pixel_dropout",
        "Albu Pixel Dropout",
        "channels",
        "image_only",
        "Set random pixels to a fill value.",
        (
            _num("dropout_prob", "Dropout Prob", 0.01, 0.0, 1.0, 0.01),
            _num("drop_value", "Drop Value", 0, 0, 255, 1),
            _p(),
        ),
    ),
    AlbuEntry(
        "CoarseDropout",
        "albu_coarse_dropout",
        "Albu Coarse Dropout",
        "channels",
        "image_only",
        "Drop rectangular regions (cutout-style).",
        (
            _int("num_holes_min", "Holes Min", 1, 1, 32),
            _int("num_holes_max", "Holes Max", 8, 1, 32),
            _num("hole_height_min", "Hole H Fraction Min", 0.1, 0.01, 1.0, 0.01),
            _num("hole_height_max", "Hole H Fraction Max", 0.2, 0.01, 1.0, 0.01),
            _num("hole_width_min", "Hole W Fraction Min", 0.1, 0.01, 1.0, 0.01),
            _num("hole_width_max", "Hole W Fraction Max", 0.2, 0.01, 1.0, 0.01),
            _p(),
        ),
    ),
    AlbuEntry(
        "Erasing",
        "albu_erasing",
        "Albu Erasing",
        "channels",
        "image_only",
        "Random erasing augmentation.",
        (_p(),),
    ),
    AlbuEntry(
        "Superpixels",
        "albu_superpixels",
        "Albu Superpixels",
        "channels",
        "image_only",
        "Approximate image with superpixels.",
        (
            _num("p_replace", "Replace Prob", 0.1, 0.0, 1.0, 0.05),
            _int("n_segments", "N Segments", 100, 10, 500),
            _p(),
        ),
    ),
)


# ---------------------------------------------------------------------------
# Dual geometry (mask / bboxes / keypoints stay aligned)
# ---------------------------------------------------------------------------
DUAL_GEOMETRY_ENTRIES: tuple[AlbuEntry, ...] = (
    AlbuEntry(
        "HorizontalFlip",
        "albu_horizontal_flip",
        "Albu Horizontal Flip",
        "geometry",
        "dual",
        "Flip horizontally (syncs mask, bboxes, keypoints).",
        (_p(0.5),),
    ),
    AlbuEntry(
        "VerticalFlip",
        "albu_vertical_flip",
        "Albu Vertical Flip",
        "geometry",
        "dual",
        "Flip vertically (syncs mask, bboxes, keypoints).",
        (_p(0.5),),
    ),
    AlbuEntry(
        "RandomRotate90",
        "albu_random_rotate90",
        "Albu Random Rotate 90",
        "geometry",
        "dual",
        "Rotate by a random multiple of 90°.",
        (_p(1.0),),
    ),
    AlbuEntry(
        "Transpose",
        "albu_transpose",
        "Albu Transpose",
        "geometry",
        "dual",
        "Transpose the image (swap rows/cols).",
        (_p(1.0),),
    ),
    AlbuEntry(
        "D4",
        "albu_d4",
        "Albu D4",
        "geometry",
        "dual",
        "Random D4 dihedral group transform.",
        (_p(1.0),),
    ),
    AlbuEntry(
        "Rotate",
        "albu_rotate",
        "Albu Rotate",
        "geometry",
        "dual",
        "Rotate by a random angle.",
        (
            _num("limit", "Angle Limit", 45, 0, 180, 1),
            _sel(
                "border_mode",
                "Border Mode",
                "constant",
                ("constant", "replicate", "reflect", "wrap", "reflect101"),
            ),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "SafeRotate",
        "albu_safe_rotate",
        "Albu Safe Rotate",
        "geometry",
        "dual",
        "Rotate and resize to keep the full image.",
        (_num("limit", "Angle Limit", 45, 0, 180, 1), _p(1.0)),
    ),
    AlbuEntry(
        "Affine",
        "albu_affine",
        "Albu Affine",
        "geometry",
        "dual",
        "Affine transform (scale / translate / rotate / shear).",
        (
            _num("scale", "Scale", 1.0, 0.5, 1.5, 0.05),
            _num("translate_percent", "Translate %", 0.1, 0.0, 0.5, 0.01),
            _num("rotate", "Rotate", 15, 0, 180, 1),
            _num("shear", "Shear", 10, 0, 45, 1),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "Perspective",
        "albu_perspective",
        "Albu Perspective",
        "geometry",
        "dual",
        "Random perspective transform.",
        (_num("scale", "Scale", 0.05, 0.01, 0.3, 0.01), _p(1.0)),
    ),
    AlbuEntry(
        "ElasticTransform",
        "albu_elastic_transform",
        "Albu Elastic Transform",
        "geometry",
        "dual",
        "Elastic deformation.",
        (
            _num("alpha", "Alpha", 1.0, 0.1, 50.0, 0.1),
            _num("sigma", "Sigma", 50.0, 1.0, 100.0, 1.0),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "GridDistortion",
        "albu_grid_distortion",
        "Albu Grid Distortion",
        "geometry",
        "dual",
        "Grid-based distortion.",
        (
            _int("num_steps", "Num Steps", 5, 1, 20),
            _num("distort_limit", "Distort Limit", 0.3, 0.0, 1.0, 0.05),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "OpticalDistortion",
        "albu_optical_distortion",
        "Albu Optical Distortion",
        "geometry",
        "dual",
        "Barrel / pincushion distortion.",
        (
            _num("distort_limit", "Distort Limit", 0.05, 0.0, 0.5, 0.01),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "Resize",
        "albu_resize",
        "Albu Resize",
        "geometry",
        "dual",
        "Resize to a fixed height/width.",
        (
            _int("height", "Height", 256, 8, 4096),
            _int("width", "Width", 256, 8, 4096),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "LongestMaxSize",
        "albu_longest_max_size",
        "Albu Longest Max Size",
        "geometry",
        "dual",
        "Rescale so the longest side equals max_size.",
        (_int("max_size", "Max Size", 512, 16, 4096), _p(1.0)),
    ),
    AlbuEntry(
        "SmallestMaxSize",
        "albu_smallest_max_size",
        "Albu Smallest Max Size",
        "geometry",
        "dual",
        "Rescale so the shortest side equals max_size.",
        (_int("max_size", "Max Size", 512, 16, 4096), _p(1.0)),
    ),
    AlbuEntry(
        "PadIfNeeded",
        "albu_pad_if_needed",
        "Albu Pad If Needed",
        "geometry",
        "dual",
        "Pad to at least min height/width.",
        (
            _int("min_height", "Min Height", 256, 1, 4096),
            _int("min_width", "Min Width", 256, 1, 4096),
            _sel(
                "border_mode",
                "Border Mode",
                "constant",
                ("constant", "replicate", "reflect", "wrap", "reflect101"),
            ),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "CenterCrop",
        "albu_center_crop",
        "Albu Center Crop",
        "geometry",
        "dual",
        "Crop the center of the image.",
        (
            _int("height", "Height", 128, 8, 4096),
            _int("width", "Width", 128, 8, 4096),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "RandomCrop",
        "albu_random_crop",
        "Albu Random Crop",
        "geometry",
        "dual",
        "Crop a random region.",
        (
            _int("height", "Height", 128, 8, 4096),
            _int("width", "Width", 128, 8, 4096),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "Crop",
        "albu_crop",
        "Albu Crop",
        "geometry",
        "dual",
        "Crop a fixed rectangle.",
        (
            _int("x_min", "X Min", 0, 0, 4096),
            _int("y_min", "Y Min", 0, 0, 4096),
            _int("x_max", "X Max", 128, 1, 4096),
            _int("y_max", "Y Max", 128, 1, 4096),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "RandomScale",
        "albu_random_scale",
        "Albu Random Scale",
        "geometry",
        "dual",
        "Randomly rescale the image.",
        (
            _num("scale_limit", "Scale Limit", 0.1, 0.0, 1.0, 0.01),
            _p(1.0),
        ),
    ),
    AlbuEntry(
        "ShiftScaleRotate",
        "albu_shift_scale_rotate",
        "Albu Shift Scale Rotate",
        "geometry",
        "dual",
        "Combined shift / scale / rotate (legacy).",
        (
            _num("shift_limit", "Shift Limit", 0.0625, 0.0, 0.5, 0.01),
            _num("scale_limit", "Scale Limit", 0.1, 0.0, 1.0, 0.01),
            _num("rotate_limit", "Rotate Limit", 45, 0, 180, 1),
            _p(1.0),
        ),
    ),
)


ALBUMENTATIONS_CATALOG: tuple[AlbuEntry, ...] = (
    COLOR_ENTRIES
    + BLUR_NOISE_ENTRIES
    + WEATHER_ENTRIES
    + NORMALIZE_CHANNEL_ENTRIES
    + DUAL_GEOMETRY_ENTRIES
)
