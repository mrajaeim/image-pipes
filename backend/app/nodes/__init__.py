"""Register all built-in OpenCV nodes."""

from app.engine.registry import registry
from app.nodes.analysis import (
    AdaptiveThresholdNode,
    BlurDetectNode,
    CompareHistNode,
    DistanceTransformNode,
    DrawHistogramNode,
    HistogramEqualizeNode,
    NormalizeNode,
)
from app.nodes.clustering import DominantColorsHistNode, KMeansColorsNode
from app.nodes.color import (
    BrightnessContrastNode,
    ClaheNode,
    InRangeNode,
    InvertNode,
    MergeChannelsNode,
    SplitChannelsNode,
    ToBgrNode,
    ToGrayNode,
    ToHsvNode,
    ToLabNode,
    ToRgbNode,
    ToYCrCbNode,
    ToYuvNode,
)
from app.nodes.filters import (
    BilateralFilterNode,
    BoxBlurNode,
    CannyNode,
    GaussianBlurNode,
    LaplacianNode,
    MedianBlurNode,
    SharpenNode,
    SobelNode,
    ThresholdNode,
)
from app.nodes.geometry import CropNode, FlipNode, ResizeNode, RotateNode
from app.nodes.io import BlankImageNode, LoadImageNode, PreviewNode, SaveImageNode
from app.nodes.morphology import DilateNode, ErodeNode, MorphologyExNode
from app.nodes.stochastic import GaussianNoiseNode, RandomBrightnessContrastNode
from app.nodes.structure import (
    ApproxPolyNode,
    BlobDetectNode,
    BoundingRectNode,
    ConnectedComponentsNode,
    ConvexHullNode,
    FindContoursNode,
    ImageMomentsNode,
)

_REGISTERED = False


def register_builtin_nodes() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    for node in (
        LoadImageNode(),
        BlankImageNode(),
        SaveImageNode(),
        PreviewNode(),
        ToGrayNode(),
        ToHsvNode(),
        ToRgbNode(),
        ToBgrNode(),
        ToLabNode(),
        ToYuvNode(),
        ToYCrCbNode(),
        InvertNode(),
        ClaheNode(),
        BrightnessContrastNode(),
        SplitChannelsNode(),
        MergeChannelsNode(),
        InRangeNode(),
        GaussianBlurNode(),
        MedianBlurNode(),
        BoxBlurNode(),
        BilateralFilterNode(),
        SharpenNode(),
        CannyNode(),
        SobelNode(),
        LaplacianNode(),
        ThresholdNode(),
        AdaptiveThresholdNode(),
        DistanceTransformNode(),
        HistogramEqualizeNode(),
        DrawHistogramNode(),
        NormalizeNode(),
        CompareHistNode(),
        BlurDetectNode(),
        KMeansColorsNode(),
        DominantColorsHistNode(),
        FindContoursNode(),
        ConvexHullNode(),
        ImageMomentsNode(),
        ConnectedComponentsNode(),
        BlobDetectNode(),
        BoundingRectNode(),
        ApproxPolyNode(),
        ErodeNode(),
        DilateNode(),
        MorphologyExNode(),
        ResizeNode(),
        RotateNode(),
        CropNode(),
        FlipNode(),
        RandomBrightnessContrastNode(),
        GaussianNoiseNode(),
    ):
        if not registry.has(node.type):
            registry.register(node)
    _REGISTERED = True


register_builtin_nodes()
