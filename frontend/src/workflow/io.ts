/** Versioned workflow JSON for export / load. */

export const DEFAULT_WORKFLOW_NAME = 'Untitled'

export interface WorkflowWaypoint {
  x: number
  y: number
}

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
    /** Optional bend anchors for reshaped connectors. */
    waypoints?: WorkflowWaypoint[]
  }>
}

export type WorkflowAssetFile = {
  name: string
  /** Absolute path when available (same-machine restore). */
  path?: string
  /** Portable file bytes for cross-machine import. */
  content_b64?: string
}

export type WorkflowAssetBatch = {
  kind: 'external' | 'staged' | 'folder'
  root?: string | null
  files: WorkflowAssetFile[]
}

export type WorkflowAssets = Record<string, WorkflowAssetBatch>

export interface WorkflowDocument {
  version: 1
  id?: string
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
  seed: number
  /** How many times to run the pipeline (stochastic variation). */
  iterationCount: number
  graph: WorkflowGraphPayload
  /** Asset registry batches referenced by load_image nodes (export/import). */
  assets?: WorkflowAssets
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isGraphPayload(value: unknown): value is WorkflowGraphPayload {
  if (!isRecord(value)) return false
  return Array.isArray(value.nodes) && Array.isArray(value.edges)
}

function normalizeWaypoints(value: unknown): WorkflowWaypoint[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const points = value
    .filter(isRecord)
    .map((point) => ({
      x: Number(point.x ?? 0),
      y: Number(point.y ?? 0),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  return points.length > 0 ? points : undefined
}

function normalizeGraph(graph: WorkflowGraphPayload): WorkflowGraphPayload {
  return {
    nodes: graph.nodes.map((node) => {
      const record = node as unknown as Record<string, unknown>
      const position = isRecord(record.position) ? record.position : {}
      const params = isRecord(record.params) ? { ...record.params } : {}
      // Drop legacy load_image.path — assets use asset_batch_id + embedded registry.
      if (String(record.type ?? '') === 'load_image') {
        delete params.path
      }
      return {
        id: String(record.id ?? ''),
        type: String(record.type ?? ''),
        params,
        position: {
          x: Number(position.x ?? 0),
          y: Number(position.y ?? 0),
        },
      }
    }),
    edges: graph.edges.map((edge) => {
      const record = edge as unknown as Record<string, unknown>
      const waypoints = normalizeWaypoints(record.waypoints)
      return {
        id: String(record.id ?? ''),
        source: String(record.source ?? ''),
        source_port: String(record.source_port ?? 'image'),
        target: String(record.target ?? ''),
        target_port: String(record.target_port ?? 'image'),
        ...(waypoints ? { waypoints } : {}),
      }
    }),
  }
}

function normalizeAssets(value: unknown): WorkflowAssets | undefined {
  if (!isRecord(value)) return undefined
  const assets: WorkflowAssets = {}
  for (const [batchId, rawBatch] of Object.entries(value)) {
    if (!isRecord(rawBatch) || !Array.isArray(rawBatch.files)) continue
    const kindRaw = String(rawBatch.kind ?? 'external')
    const kind: WorkflowAssetBatch['kind'] =
      kindRaw === 'staged' || kindRaw === 'folder' ? kindRaw : 'external'
    const files: WorkflowAssetFile[] = []
    for (const item of rawBatch.files) {
      if (!isRecord(item)) continue
      const name = String(item.name ?? '').trim()
      if (!name) continue
      const path = typeof item.path === 'string' ? item.path : undefined
      const content_b64 =
        typeof item.content_b64 === 'string' ? item.content_b64 : undefined
      files.push({
        name,
        ...(path ? { path } : {}),
        ...(content_b64 ? { content_b64 } : {}),
      })
    }
    if (files.length === 0) continue
    assets[batchId] = {
      kind,
      root: typeof rawBatch.root === 'string' ? rawBatch.root : null,
      files,
    }
  }
  return Object.keys(assets).length > 0 ? assets : undefined
}

function readIterationCount(value: Record<string, unknown>): number {
  const raw =
    typeof value.iterationCount === 'number'
      ? value.iterationCount
      : typeof value.iteration_count === 'number'
        ? value.iteration_count
        : typeof value.sampleCount === 'number'
          ? value.sampleCount
          : typeof value.sample_count === 'number'
            ? value.sample_count
            : 1
  return Math.max(1, raw)
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Accept versioned docs, example wrappers, or bare `{ nodes, edges }` graphs. */
export function coerceWorkflowDocument(value: unknown): WorkflowDocument {
  if (!isRecord(value)) {
    throw new Error('Not a valid Image Pipes workflow')
  }

  if (value.version != null && value.version !== 1) {
    throw new Error(`Unsupported workflow version: ${String(value.version)}`)
  }

  let graph: WorkflowGraphPayload | null = null
  if (isGraphPayload(value.graph)) {
    graph = value.graph
  } else if (isGraphPayload(value)) {
    graph = value
  }

  if (!graph) {
    throw new Error(
      'Not a valid Image Pipes workflow (need graph.nodes / graph.edges)',
    )
  }

  const name = readOptionalString(value.name) ?? DEFAULT_WORKFLOW_NAME
  const description = readOptionalString(value.description)
  const id = readOptionalString(value.id)
  const createdAt = readOptionalString(value.createdAt)
  const updatedAt = readOptionalString(value.updatedAt)
  const assets = normalizeAssets(value.assets)

  return {
    version: 1,
    ...(id ? { id } : {}),
    name,
    ...(description ? { description } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    seed: typeof value.seed === 'number' ? value.seed : 0,
    iterationCount: readIterationCount(value),
    graph: normalizeGraph(graph),
    ...(assets ? { assets } : {}),
  }
}

export function isWorkflowDocument(value: unknown): value is WorkflowDocument {
  try {
    coerceWorkflowDocument(value)
    return true
  } catch {
    return false
  }
}

export function parseWorkflowJson(text: string): WorkflowDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid JSON file')
  }
  return coerceWorkflowDocument(parsed)
}

/** Sanitize a workflow name into a safe download filename stem. */
export function workflowFilename(name: string, fallback = 'workflow'): string {
  const stem = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${stem || fallback}.json`
}

export function downloadWorkflowJson(doc: WorkflowDocument, filename?: string) {
  const resolved = filename ?? workflowFilename(doc.name)
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = resolved
  anchor.click()
  URL.revokeObjectURL(url)
}
