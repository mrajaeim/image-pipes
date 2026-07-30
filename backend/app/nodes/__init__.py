"""Register all built-in OpenCV nodes."""

from app.engine.registry import registry
from app.nodes.analysis import (
    AdaptiveThresholdNode,
    DistanceTransformNode,
    HistogramEqualizeNode,
)
from app.nodes.color import (
    BrightnessContrastNode,
    ClaheNode,
    InRangeNode,
    InvertNode,
    MergeChannelsNode,
    SplitChannelsNode,
    ToGrayNode,
    ToHsvNode,
    ToLabNode,
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
    SobelNode,
    ThresholdNode,
)
from app.nodes.geometry import CropNode, FlipNode, ResizeNode, RotateNode
from app.nodes.io import LoadImageNode, PreviewNode, SaveImageNode
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
        SaveImageNode(),
        PreviewNode(),
        ToGrayNode(),
        ToHsvNode(),
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
        CannyNode(),
        SobelNode(),
        LaplacianNode(),
        ThresholdNode(),
        AdaptiveThresholdNode(),
        DistanceTransformNode(),
        HistogramEqualizeNode(),
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
