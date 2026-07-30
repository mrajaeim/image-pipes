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
  generatedCode: string
  isExecuting: boolean
  seed: number
  sampleCount: number
  setNodeCatalog: (catalog: NodeMetadata[]) => void
  onNodesChange: (changes: NodeChange<PipelineNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onReconnect: (oldEdge: Edge, connection: Connection) => void
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
  setGeneratedCode: (code: string) => void
  setIsExecuting: (value: boolean) => void
  setSeed: (seed: number) => void
  setSampleCount: (count: number) => void
  getInputImages: (nodeId: string) => string[]
  getResultImages: (nodeId: string) => string[]
  toGraphPayload: () => {
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
}

let nodeCounter = 1

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
  generatedCode: '# Run codegen to export a Python script\n',
  isExecuting: false,
  seed: 0,
  sampleCount: 1,

  setNodeCatalog: (catalog) => set({ nodeCatalog: catalog }),

  onNodesChange: (changes) => {
    const removedIds = changes
      .filter((change) => change.type === 'remove')
      .map((change) => change.id)

    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes)
      if (removedIds.length === 0) {
        return { nodes }
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
      }
    })
  },

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({
      edges: addEdge(
        {
          ...connection,
          id: `e-${crypto.randomUUID()}`,
          reconnectable: true,
          selectable: true,
        },
        get().edges,
      ),
    }),

  onReconnect: (oldEdge, connection) => {
    const next = get().edges
      .filter((edge) => edge.id !== oldEdge.id)
      .concat({
        ...oldEdge,
        ...connection,
        id: oldEdge.id,
        source: connection.source ?? oldEdge.source,
        target: connection.target ?? oldEdge.target,
        sourceHandle: connection.sourceHandle ?? oldEdge.sourceHandle,
        targetHandle: connection.targetHandle ?? oldEdge.targetHandle,
        reconnectable: true,
        selectable: true,
      })
    set({ edges: next })
  },

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
    set({ nodes: [...get().nodes, node], selectedNodeId: id })
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
    const ports = { ...existing.ports, [portId]: preview.imageB64 }
    const portSamples = { ...existing.portSamples }
    const portStack = [...(portSamples[portId] ?? [])]
    while (portStack.length <= preview.sampleIndex) {
      portStack.push('')
    }
    portStack[preview.sampleIndex] = preview.imageB64
    portSamples[portId] = portStack

    const nextSamples = [...existing.samples]
    if (portId === 'image' || Object.keys(ports).length === 1) {
      while (nextSamples.length <= preview.sampleIndex) {
        nextSamples.push('')
      }
      nextSamples[preview.sampleIndex] = preview.imageB64
    }

    set({
      previews: [...get().previews, preview],
      nodeImages: {
        ...get().nodeImages,
        [preview.nodeId]: {
          result: ports.image ?? Object.values(ports)[0] ?? preview.imageB64,
          samples: nextSamples,
          ports,
          portSamples,
        },
      },
    })
  },

  clearExecution: () =>
    set({
      previews: [],
      nodeImages: {},
      logs: [],
      activeNodeId: null,
      nodes: get().nodes.map((node) => ({
        ...node,
        data: { ...node.data, active: false },
      })),
    }),

  appendLog: (message) => set({ logs: [...get().logs, message] }),
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setIsExecuting: (value) => set({ isExecuting: value }),
  setSeed: (seed) => set({ seed }),
  setSampleCount: (count) => set({ sampleCount: Math.max(1, count) }),

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
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        source_port: edge.sourceHandle ?? 'image',
        target: edge.target,
        target_port: edge.targetHandle ?? 'image',
      })),
    }
  },
}))
