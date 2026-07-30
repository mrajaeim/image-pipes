"""Generate standalone Python scripts from a playground graph."""

from __future__ import annotations

from app.engine.executor import topological_sort, validate_graph
from app.engine.registry import registry
from app.models.graph import Graph
from app.nodes import register_builtin_nodes


def generate_python(graph: Graph, seed: int = 0) -> str:
    register_builtin_nodes()
    validate_graph(graph, registry)
    order = topological_sort(graph)
    nodes = {node.id: node for node in graph.nodes}

    lines: list[str] = [
        '"""Auto-generated Image Pipes pipeline."""',
        "",
        "from __future__ import annotations",
        "",
        "from pathlib import Path",
        "",
        "import cv2",
        "import numpy as np",
        "",
        "",
        f"def run(seed: int = {seed}) -> None:",
    ]

    outputs_by_node: dict[str, dict[str, str]] = {}

    for node_id in order:
        instance = nodes[node_id]
        impl = registry.get(instance.type)
        params = impl.validate_params(instance.params)
        safe_id = node_id.replace("-", "_")

        input_vars: dict[str, str] = {}
        for edge in graph.edges:
            if edge.target != node_id:
                continue
            source_outputs = outputs_by_node.get(edge.source, {})
            source_var = source_outputs.get(edge.source_port)
            if source_var:
                input_vars[edge.target_port] = source_var

        output_ports = [port.id for port in impl.ports if port.direction.value == "output"]
        if not output_ports:
            output_ports = ["image"]
        output_vars = {port: f"{safe_id}_{port}" for port in output_ports}
        outputs_by_node[node_id] = output_vars

        lines.append(f"    # node: {node_id} ({instance.type})")
        emitted = impl.emit_python(node_id, params, input_vars, output_vars)
        for statement in emitted:
            lines.append(f"    {statement}")

        primary = output_vars.get("image")
        if primary:
            lines.append(f"    print('produced', '{node_id}', {primary}.shape)")
        else:
            for port, var_name in output_vars.items():
                lines.append(f"    print('produced', '{node_id}:{port}', {var_name}.shape)")

    lines.extend(
        [
            "",
            "",
            'if __name__ == "__main__":',
            "    run()",
            "",
        ]
    )
    return "\n".join(lines)
