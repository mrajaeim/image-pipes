import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import type { ExecutionPreview, GraphNodeData, NodeMetadata } from '../types'
import {
  DEFAULT_WORKFLOW_NAME,
  type WorkflowDocument,
  type WorkflowGraphPayload,
} from '../workflow/io'
import { portTypeColor } from '../lib/portTypes'


type PipelineNode = Node<GraphNodeData>

/** Latest execution images keyed by node id for canvas thumbnails. */
export type NodeImageState = {
  result: string | null
  /** Primary / single-port samples (usually `image`). */
  samples: string[]
  /** Latest image per port (compat / single-sample multiport). */
  ports: Record<string, string>
  /** Per-port sample stacks: portId → images[sampleIndex]. */
  portSamples: Record<string, string[]>
  /** Latest bbox / keypoint payloads from preview events. */
  annotations?: {
    bboxes?: unknown
    keypoints?: unknown
  }
}

/** Latest measured execution duration per node id. */
export type NodeTiming = {
  ms: number
  cacheHit: boolean
}

interface GraphState {
  nodes: PipelineNode[]
  edges: Edge[]
  selectedNodeId: string | null
  nodeCatalog: NodeMetadata[]
  activeNodeId: string | null
  previews: ExecutionPreview[]
  nodeImages: Record<string, NodeImageState>
  logs: string[]
  nodeTimings: Record<string, NodeTiming>
  generatedCode: string
  isExecuting: boolean
  seed: number
  sampleCount: number
  /** Bumped on loadWorkflow so the canvas can refit the viewport. */
  graphRevision: number
  workflowId: string | null
  workflowName: string
  workflowDescription: string
  workflowCreatedAt: string | null
  workflowUpdatedAt: string | null
  workflowDirty: boolean
  setNodeCatalog: (catalog: NodeMetadata[]) => void
  onNodesChange: (changes: NodeChange<PipelineNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onReconnect: (oldEdge: Edge, connection: Connection) => void
  setEdgeWaypoints: (edgeId: string, waypoints: { x: number; y: number }[]) => void
  addNodeFromType: (meta: NodeMetadata, position: { x: number; y: number }) => void
  removeNode: (nodeId: string) => void
  duplicateNode: (nodeId: string) => void
  selectNode: (nodeId: string | null) => void
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void
  setLocalPreview: (nodeId: string, dataUrl: string | null) => void
  setLocalPreviews: (nodeId: string, dataUrls: string[], uploadedFiles?: string[]) => void
  removeLocalPreview: (nodeId: string, index: number) => {
    file: string | null
    path: string
  } | null
  setActiveNodeId: (nodeId: string | null) => void
  addPreview: (preview: ExecutionPreview) => void
  clearExecution: () => void
  appendLog: (message: string) => void
  setNodeTiming: (nodeId: string, timing: NodeTiming) => void
  setGeneratedCode: (code: string) => void
  setIsExecuting: (value: boolean) => void
  setSeed: (seed: number) => void
  setSampleCount: (count: number) => void
  setWorkflowMeta: (meta: { name?: string; description?: string }) => void
  markworkflowDirty: () => void
  markWorkflowClean: (record?: {
    id: string
    name: string
    description?: string
    createdAt?: string
    updatedAt?: string
  }) => void
  newWorkflow: () => void
  getInputImages: (nodeId: string) => string[]
  getResultImages: (nodeId: string) => string[]
  toGraphPayload: () => WorkflowGraphPayload
  toWorkflowDocument: () => WorkflowDocument
  loadWorkflow: (doc: WorkflowDocument) => { skippedTypes: string[] }
}

const STRUCTURAL_NODE_CHANGE_TYPES = new Set(['add', 'remove', 'position', 'replace'])

let nodeCounter = 1

function syncNodeCounter(nodeIds: string[]) {
  let max = 0
  for (const id of nodeIds) {
    const match = /-(\d+)$/.exec(id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  nodeCounter = Math.max(nodeCounter, max + 1)
}

function emptyNodeImages(): NodeImageState {
  return { result: null, samples: [], ports: {}, portSamples: {} }
}

function resultForNode(
  nodeImages: Record<string, NodeImageState>,
  nodeId: string,
): string | null {
  const entry = nodeImages[nodeId]
  if (!entry) return null
  return (
    entry.ports.image ??
    entry.portSamples.image?.find(Boolean) ??
    entry.result ??
    entry.samples.at(-1) ??
    null
  )
}

function imagesForPort(entry: NodeImageState, portId: string): string[] {
  const stacked = entry.portSamples[portId]?.filter(Boolean)
  if (stacked && stacked.length > 0) return stacked
  const latest = entry.ports[portId]
  if (latest) return [latest]
  if (portId === 'image') {
    const samples = entry.samples.filter(Boolean)
    if (samples.length > 0) return samples
    if (entry.result) return [entry.result]
  }
  return []
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  nodeCatalog: [],
  activeNodeId: null,
  previews: [],
  nodeImages: {},
  logs: [],
  nodeTimings: {},
  generatedCode: '# Run codegen to export a Python script\n',
  isExecuting: false,
  seed: 0,
  sampleCount: 1,
  graphRevision: 0,
  workflowId: null,
  workflowName: DEFAULT_WORKFLOW_NAME,
  workflowDescription: '',
  workflowCreatedAt: null,
  workflowUpdatedAt: null,
  workflowDirty: false,

  setNodeCatalog: (catalog) => set({ nodeCatalog: catalog }),

  onNodesChange: (changes) => {
    const removedIds = changes
      .filter((change) => change.type === 'remove')
      .map((change) => change.id)
    const structural = changes.some((change) =>
      STRUCTURAL_NODE_CHANGE_TYPES.has(change.type),
    )

    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes)
      const dirtyPatch = structural && !state.workflowDirty ? { workflowDirty: true } : {}
      if (removedIds.length === 0) {
        return { nodes, ...dirtyPatch }
      }

      const removed = new Set(removedIds)
      const nodeImages = { ...state.nodeImages }
      for (const id of removedIds) {
        delete nodeImages[id]
      }

      return {
        nodes,
        edges: state.edges.filter(
          (edge) => !removed.has(edge.source) && !removed.has(edge.target),
        ),
        nodeImages,
        previews: state.previews.filter((preview) => !removed.has(preview.nodeId)),
        selectedNodeId:
          state.selectedNodeId && removed.has(state.selectedNodeId)
            ? null
            : state.selectedNodeId,
        activeNodeId:
          state.activeNodeId && removed.has(state.activeNodeId) ? null : state.activeNodeId,
        ...dirtyPatch,
      }
    })
  },

  onEdgesChange: (changes) => {
    const structural = changes.some(
      (change) => change.type === 'remove' || change.type === 'add' || change.type === 'replace',
    )
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      ...(structural ? { workflowDirty: true } : {}),
    }))
  },

  onConnect: (connection) => {
    const nodes = get().nodes
    const sourceNode = nodes.find((node) => node.id === connection.source)
    const sourcePort = sourceNode?.data.ports.find(
      (port) =>
        port.direction === 'output' &&
        port.id === (connection.sourceHandle ?? 'image'),
    )
    const stroke = portTypeColor(sourcePort?.data_type ?? 'image', '#7dcea0')
    set({
      edges: addEdge(
        {
          ...connection,
          id: `e-${crypto.randomUUID()}`,
          type: 'editable',
          zIndex: 1000,
          reconnectable: true,
          selectable: true,
          style: { stroke, strokeWidth: 2 },
          data: { waypoints: [], dataType: sourcePort?.data_type ?? 'image' },
        },
        get().edges,
      ),
      workflowDirty: true,
    })
  },

  onReconnect: (oldEdge, connection) => {
    const next = get().edges
      .filter((edge) => edge.id !== oldEdge.id)
      .concat({
        ...oldEdge,
        ...connection,
        id: oldEdge.id,
        type: oldEdge.type ?? 'editable',
        zIndex: oldEdge.zIndex ?? 1000,
        source: connection.source ?? oldEdge.source,
        target: connection.target ?? oldEdge.target,
        sourceHandle: connection.sourceHandle ?? oldEdge.sourceHandle,
        targetHandle: connection.targetHandle ?? oldEdge.targetHandle,
        reconnectable: true,
        selectable: true,
        data: oldEdge.data ?? { waypoints: [] },
      })
    set({ edges: next, workflowDirty: true })
  },

  setEdgeWaypoints: (edgeId, waypoints) =>
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              data: {
                ...(edge.data as Record<string, unknown> | undefined),
                waypoints,
              },
            }
          : edge,
      ),
      workflowDirty: true,
    }),

  addNodeFromType: (meta, position) => {
    const id = `${meta.type}-${nodeCounter++}`
    const defaults = Object.fromEntries(meta.params.map((field) => [field.name, field.default]))
    const node: PipelineNode = {
      id,
      type: 'pipeline',
      position,
      data: {
        type: meta.type,
        label: meta.label,
        category: meta.category,
        params: defaults,
        ports: meta.ports,
        localPreviewUrls: [],
      },
    }
    set({ nodes: [...get().nodes, node], selectedNodeId: id, workflowDirty: true })
  },

  removeNode: (nodeId) => {
    get().onNodesChange([{ type: 'remove', id: nodeId }])
  },

  duplicateNode: (nodeId) => {
    const source = get().nodes.find((node) => node.id === nodeId)
    if (!source) return
    const id = `${source.data.type}-${nodeCounter++}`
    const copy: PipelineNode = {
      ...source,
      id,
      selected: false,
      position: {
        x: source.position.x + 48,
        y: source.position.y + 48,
      },
      data: {
        ...source.data,
        params: { ...source.data.params },
        active: false,
        localPreviewUrls: [...(source.data.localPreviewUrls ?? [])],
        uploadedFiles: [...(source.data.uploadedFiles ?? [])],
      },
    }
    set({
      nodes: [...get().nodes.map((node) => ({ ...node, selected: false })), copy],
      selectedNodeId: id,
      workflowDirty: true,
    })
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNodeParams: (nodeId, params) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, params: { ...node.data.params, ...params } } }
          : node,
      ),
      workflowDirty: true,
    }),

  setLocalPreview: (nodeId, dataUrl) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                localPreviewUrls: dataUrl ? [dataUrl] : [],
                uploadedFiles: [],
              },
            }
          : node,
      ),
      workflowDirty: true,
    }),

  setLocalPreviews: (nodeId, dataUrls, uploadedFiles = []) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                localPreviewUrls: dataUrls,
                uploadedFiles,
              },
            }
          : node,
      ),
      workflowDirty: true,
    }),

  removeLocalPreview: (nodeId, index) => {
    const node = get().nodes.find((item) => item.id === nodeId)
    if (!node) return null
    const previews = [...(node.data.localPreviewUrls ?? [])]
    const files = [...(node.data.uploadedFiles ?? [])]
    if (index < 0 || index >= previews.length) return null
    const removedFile = files[index] ?? null
    previews.splice(index, 1)
    if (index < files.length) files.splice(index, 1)

    let nextPath = String(node.data.params.path ?? '')
    if (previews.length === 0) {
      nextPath = ''
    } else if (files.length === 1) {
      nextPath = files[0]
    } else if (files.length > 1) {
      // Keep the batch folder so remaining files continue to load together.
      const parent = files[0]?.replace(/[\\/][^\\/]+$/, '')
      if (parent) nextPath = parent
    }

    set({
      nodes: get().nodes.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              data: {
                ...item.data,
                localPreviewUrls: previews,
                uploadedFiles: files,
                params: { ...item.data.params, path: nextPath },
              },
            }
          : item,
      ),
      sampleCount: Math.max(1, previews.length),
      workflowDirty: true,
    })
    return { file: removedFile, path: nextPath }
  },

  setActiveNodeId: (nodeId) =>
    set({
      activeNodeId: nodeId,
      nodes: get().nodes.map((node) => ({
        ...node,
        data: { ...node.data, active: node.id === nodeId },
      })),
    }),

  addPreview: (preview) => {
    const portId = preview.portId ?? 'image'
    const existing = get().nodeImages[preview.nodeId] ?? emptyNodeImages()
    const ports = { ...existing.ports }
    const portSamples = { ...existing.portSamples }
    const nextSamples = [...existing.samples]
    let annotations = existing.annotations

    if (preview.imageB64) {
      ports[portId] = preview.imageB64
      const portStack = [...(portSamples[portId] ?? [])]
      while (portStack.length <= preview.sampleIndex) {
        portStack.push('')
      }
      portStack[preview.sampleIndex] = preview.imageB64
      portSamples[portId] = portStack

      if (portId === 'image' || Object.keys(ports).length === 1) {
        while (nextSamples.length <= preview.sampleIndex) {
          nextSamples.push('')
        }
        nextSamples[preview.sampleIndex] = preview.imageB64
      }
    }

    if (preview.data) {
      annotations = {
        ...annotations,
        ...(preview.data.bboxes !== undefined ? { bboxes: preview.data.bboxes } : {}),
        ...(preview.data.keypoints !== undefined
          ? { keypoints: preview.data.keypoints }
          : {}),
      }
    }

    set({
      previews: [...get().previews, preview],
      nodeImages: {
        ...get().nodeImages,
        [preview.nodeId]: {
          result: ports.image ?? Object.values(ports)[0] ?? existing.result,
          samples: nextSamples,
          ports,
          portSamples,
          annotations,
        },
      },
    })
  },

  clearExecution: () =>
    set({
      previews: [],
      nodeImages: {},
      logs: [],
      nodeTimings: {},
      activeNodeId: null,
      nodes: get().nodes.map((node) => ({
        ...node,
        data: { ...node.data, active: false },
      })),
    }),

  appendLog: (message) => set({ logs: [...get().logs, message] }),
  setNodeTiming: (nodeId, timing) =>
    set({
      nodeTimings: { ...get().nodeTimings, [nodeId]: timing },
    }),
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setIsExecuting: (value) => set({ isExecuting: value }),
  setSeed: (seed) => set({ seed, workflowDirty: true }),
  setSampleCount: (count) => set({ sampleCount: Math.max(1, count), workflowDirty: true }),

  setWorkflowMeta: (meta) =>
    set((state) => ({
      workflowName:
        meta.name !== undefined
          ? meta.name.trim() || DEFAULT_WORKFLOW_NAME
          : state.workflowName,
      workflowDescription:
        meta.description !== undefined ? meta.description : state.workflowDescription,
      workflowDirty: true,
    })),

  markworkflowDirty: () => set({ workflowDirty: true }),

  markWorkflowClean: (record) =>
    set((state) => ({
      workflowDirty: false,
      workflowId: record?.id ?? state.workflowId,
      workflowName: record?.name ?? state.workflowName,
      workflowDescription:
        record?.description !== undefined
          ? record.description
          : state.workflowDescription,
      workflowCreatedAt: record?.createdAt ?? state.workflowCreatedAt,
      workflowUpdatedAt: record?.updatedAt ?? state.workflowUpdatedAt,
    })),

  newWorkflow: () => {
    nodeCounter = 1
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeNodeId: null,
      previews: [],
      nodeImages: {},
      logs: [],
      nodeTimings: {},
      isExecuting: false,
      generatedCode: '# Run codegen to export a Python script\n',
      seed: 0,
      sampleCount: 1,
      graphRevision: get().graphRevision + 1,
      workflowId: null,
      workflowName: DEFAULT_WORKFLOW_NAME,
      workflowDescription: '',
      workflowCreatedAt: null,
      workflowUpdatedAt: null,
      workflowDirty: false,
    })
  },

  getInputImages: (nodeId) => {
    const { edges, nodeImages, nodes } = get()
    const incoming = edges.filter((edge) => edge.target === nodeId)
    const fromUpstream = incoming.flatMap((edge) => {
      const entry = nodeImages[edge.source]
      if (!entry) return []
      const port = edge.sourceHandle ?? 'image'
      const stacked = imagesForPort(entry, port)
      if (stacked.length > 0) return stacked
      const fallback = resultForNode(nodeImages, edge.source)
      return fallback ? [fallback] : []
    })
    if (fromUpstream.length > 0) return fromUpstream

    const node = nodes.find((item) => item.id === nodeId)
    if (node?.data.localPreviewUrls?.length) return node.data.localPreviewUrls
    return []
  },

  getResultImages: (nodeId) => {
    const entry = get().nodeImages[nodeId]
    if (!entry) return []
    const imagePort = imagesForPort(entry, 'image')
    if (imagePort.length > 0) return imagePort
    const portIds = Object.keys(entry.portSamples)
    if (portIds.length === 1) return imagesForPort(entry, portIds[0])
    const portImages = Object.values(entry.ports).filter(Boolean)
    if (portImages.length > 0) return portImages
    return entry.result ? [entry.result] : []
  },

  toGraphPayload: () => {
    const { nodes, edges } = get()
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.type,
        params: node.data.params,
        position: node.position,
      })),
      edges: edges.map((edge) => {
        const waypoints = (
          edge.data as { waypoints?: { x: number; y: number }[] } | undefined
        )?.waypoints
        const cleaned =
          Array.isArray(waypoints) && waypoints.length > 0
            ? waypoints.map((point) => ({ x: point.x, y: point.y }))
            : undefined
        return {
          id: edge.id,
          source: edge.source,
          source_port: edge.sourceHandle ?? 'image',
          target: edge.target,
          target_port: edge.targetHandle ?? 'image',
          ...(cleaned ? { waypoints: cleaned } : {}),
        }
      }),
    }
  },

  toWorkflowDocument: () => {
    const {
      seed,
      sampleCount,
      workflowId,
      workflowName,
      workflowDescription,
      workflowCreatedAt,
      workflowUpdatedAt,
    } = get()
    return {
      version: 1 as const,
      ...(workflowId ? { id: workflowId } : {}),
      name: workflowName || DEFAULT_WORKFLOW_NAME,
      ...(workflowDescription.trim() ? { description: workflowDescription.trim() } : {}),
      ...(workflowCreatedAt ? { createdAt: workflowCreatedAt } : {}),
      ...(workflowUpdatedAt ? { updatedAt: workflowUpdatedAt } : {}),
      seed,
      sampleCount,
      graph: get().toGraphPayload(),
    }
  },

  loadWorkflow: (doc) => {
    const catalogByType = Object.fromEntries(
      get().nodeCatalog.map((meta) => [meta.type, meta]),
    )
    const skipped = new Set<string>()
    const nodes: PipelineNode[] = []
    const keptIds = new Set<string>()

    for (const raw of doc.graph.nodes) {
      const meta = catalogByType[raw.type]
      if (!meta) {
        skipped.add(raw.type)
        continue
      }
      keptIds.add(raw.id)
      nodes.push({
        id: raw.id,
        type: 'pipeline',
        position: raw.position,
        data: {
          type: meta.type,
          label: meta.label,
          category: meta.category,
          params: { ...raw.params },
          ports: meta.ports,
          localPreviewUrls: [],
          active: false,
        },
      })
    }

    const edges: Edge[] = doc.graph.edges
      .filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.source_port,
        targetHandle: edge.target_port,
        type: 'editable',
        zIndex: 1000,
        reconnectable: true,
        selectable: true,
        data: {
          waypoints: Array.isArray(edge.waypoints)
            ? edge.waypoints.map((point) => ({ x: point.x, y: point.y }))
            : [],
        },
      }))

    syncNodeCounter(nodes.map((node) => node.id))

    const preferred =
      nodes.find((node) => node.data.type === 'load_image')?.id ?? nodes[0]?.id ?? null

    set({
      nodes: nodes.map((node) => ({
        ...node,
        selected: node.id === preferred,
      })),
      edges,
      selectedNodeId: preferred,
      activeNodeId: null,
      previews: [],
      nodeImages: {},
      logs: [],
      nodeTimings: {},
      isExecuting: false,
      generatedCode: '# Run codegen to export a Python script\n',
      seed: doc.seed,
      sampleCount: Math.max(1, doc.sampleCount),
      graphRevision: get().graphRevision + 1,
      workflowId: doc.id ?? null,
      workflowName: doc.name || DEFAULT_WORKFLOW_NAME,
      workflowDescription: doc.description ?? '',
      workflowCreatedAt: doc.createdAt ?? null,
      workflowUpdatedAt: doc.updatedAt ?? null,
      workflowDirty: false,
    })

    return { skippedTypes: [...skipped].sort() }
  },
}))
