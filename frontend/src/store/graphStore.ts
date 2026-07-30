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

interface GraphState {
  nodes: PipelineNode[]
  edges: Edge[]
  selectedNodeId: string | null
  nodeCatalog: NodeMetadata[]
  activeNodeId: string | null
  previews: ExecutionPreview[]
  logs: string[]
  generatedCode: string
  isExecuting: boolean
  seed: number
  sampleCount: number
  setNodeCatalog: (catalog: NodeMetadata[]) => void
  onNodesChange: (changes: NodeChange<PipelineNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNodeFromType: (meta: NodeMetadata, position: { x: number; y: number }) => void
  selectNode: (nodeId: string | null) => void
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void
  setActiveNodeId: (nodeId: string | null) => void
  addPreview: (preview: ExecutionPreview) => void
  clearExecution: () => void
  appendLog: (message: string) => void
  setGeneratedCode: (code: string) => void
  setIsExecuting: (value: boolean) => void
  setSeed: (seed: number) => void
  setSampleCount: (count: number) => void
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

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  nodeCatalog: [],
  activeNodeId: null,
  previews: [],
  logs: [],
  generatedCode: '# Run codegen to export a Python script\n',
  isExecuting: false,
  seed: 0,
  sampleCount: 1,

  setNodeCatalog: (catalog) => set({ nodeCatalog: catalog }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, id: `e-${crypto.randomUUID()}` }, get().edges) }),

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
      },
    }
    set({ nodes: [...get().nodes, node], selectedNodeId: id })
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

  setActiveNodeId: (nodeId) =>
    set({
      activeNodeId: nodeId,
      nodes: get().nodes.map((node) => ({
        ...node,
        data: { ...node.data, active: node.id === nodeId },
      })),
    }),

  addPreview: (preview) => set({ previews: [...get().previews, preview] }),

  clearExecution: () =>
    set({
      previews: [],
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
