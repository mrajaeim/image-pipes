/** Versioned workflow JSON for export / load. */

export interface WorkflowGraphPayload {
  nodes: Array<{
    id: string
    type: string
    params: Record<string, unknown>
    position: { x: number; y: number }
  }>
  edges: Array<{
    id: string
    source: string
    source_port: string
    target: string
    target_port: string
  }>
}

export interface WorkflowDocument {
  version: 1
  seed: number
  sampleCount: number
  graph: WorkflowGraphPayload
}

export function isWorkflowDocument(value: unknown): value is WorkflowDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  if (doc.version !== 1) return false
  if (!doc.graph || typeof doc.graph !== 'object') return false
  const graph = doc.graph as Record<string, unknown>
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges)
}

export function parseWorkflowJson(text: string): WorkflowDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid JSON file')
  }
  if (!isWorkflowDocument(parsed)) {
    throw new Error('Not a valid Image Pipes workflow (expected version 1)')
  }
  return {
    version: 1,
    seed: typeof parsed.seed === 'number' ? parsed.seed : 0,
    sampleCount:
      typeof parsed.sampleCount === 'number' ? Math.max(1, parsed.sampleCount) : 1,
    graph: {
      nodes: parsed.graph.nodes.map((node) => ({
        id: String(node.id),
        type: String(node.type),
        params:
          node.params && typeof node.params === 'object'
            ? { ...(node.params as Record<string, unknown>) }
            : {},
        position: {
          x: Number(node.position?.x ?? 0),
          y: Number(node.position?.y ?? 0),
        },
      })),
      edges: parsed.graph.edges.map((edge) => ({
        id: String(edge.id),
        source: String(edge.source),
        source_port: String(edge.source_port ?? 'image'),
        target: String(edge.target),
        target_port: String(edge.target_port ?? 'image'),
      })),
    },
  }
}

export function downloadWorkflowJson(doc: WorkflowDocument, filename = 'workflow.json') {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
