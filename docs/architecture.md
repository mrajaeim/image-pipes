# Architecture & node registration

## Layers

```text
React Flow UI  --REST/WS-->  FastAPI
                               ├─ Node Registry
                               ├─ DAG Executor + Cache
                               ├─ OpenCV node implementations
                               └─ Python code generator
```

- Graphs are validated, topologically sorted, and executed node-by-node.
- Cache keys are content-addressed from `(node_type, params, input hashes, seed)`.
- Stochastic nodes re-run per sample with `seed + sample_index`.
- Codegen walks the same topo order and emits each node's `emit_python()` lines.

## Registering a new node

Create a module under `backend/app/nodes/`:

```python
from typing import Any
import cv2
import numpy as np
from app.engine.registry import BaseNode
from app.nodes.common import image_in, image_out, int_param, require_image

class BoxFilterNode(BaseNode):
    type = "box_filter"
    label = "Box Filter"
    category = "filters"
    description = "Normalized box filter."
    ports = [image_in(), image_out()]
    params = [int_param("ksize", "Kernel Size", 3, minimum=1, maximum=31)]

    def execute(self, inputs, params, seed: int = 0):
        image = require_image(inputs)
        k = int(params["ksize"])
        return {"image": cv2.boxFilter(image, -1, (k, k))}

    def emit_python(self, node_id, params, input_vars, output_vars):
        k = int(params["ksize"])
        return [
            f"{output_vars['image']} = cv2.boxFilter("
            f"{input_vars['image']}, -1, ({k}, {k}))"
        ]
```

Then register it in `backend/app/nodes/__init__.py`:

```python
from app.nodes.filters import BoxFilterNode  # or your module

# inside register_builtin_nodes():
registry.register(BoxFilterNode())
```

The palette, inspector, executor, and codegen all discover the node through the registry metadata—no React changes required unless you need custom widgets.

## Custom Python node

`custom_python` runs user-authored `process(image, seed=0)` in-process with `cv2` / `numpy` (no sandbox). Workflows that include it require an explicit UI trust step; the WebSocket execute payload must send `allow_custom_code: true` or the executor rejects the run. Trust is session-only and is not stored in exported workflow JSON.
