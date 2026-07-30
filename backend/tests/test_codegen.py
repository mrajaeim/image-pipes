"""Tests for Python code generation."""

from app.models.graph import Edge, Graph, NodeInstance
from app.nodes import register_builtin_nodes
from app.services.codegen import generate_python


def test_generate_python_contains_opencv_calls() -> None:
    register_builtin_nodes()
    graph = Graph(
        nodes=[
            NodeInstance(id="load-1", type="load_image", params={"path": "input.png"}),
            NodeInstance(id="blur-1", type="gaussian_blur", params={"ksize": 5, "sigma": 0}),
        ],
        edges=[Edge(id="e1", source="load-1", target="blur-1")],
    )
    code = generate_python(graph, seed=3)
    assert "import cv2" in code
    assert "cv2.imread" in code
    assert "cv2.GaussianBlur" in code
    assert 'if __name__ == "__main__":' in code
    assert "def run(seed: int = 3)" in code
