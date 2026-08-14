import type { Node } from '@xyflow/react'
import { useGraphStore } from '../store/graphStore'
import type { GraphNodeData, NodeMetadata } from '../types'
import type { CustomCodeNodeLike } from '../workflow/customCodeTrust'

export const IDENTITY_CODE = 'def process(image, seed=0):\n    return image\n'

export const customPythonMeta: NodeMetadata = {
  type: 'custom_python',
  label: 'Custom Python',
  category: 'script',
  description: 'User code',
  ports: [
    { id: 'image', name: 'Image', direction: 'input', data_type: 'image' },
    { id: 'image', name: 'Image', direction: 'output', data_type: 'image' },
  ],
  params: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      default: IDENTITY_CODE,
    },
  ],
  stochastic: false,
}

export const loadImageMeta: NodeMetadata = {
  type: 'load_image',
  label: 'Load Images',
  category: 'io',
  description: 'Load',
  ports: [{ id: 'image', name: 'Image', direction: 'output', data_type: 'image' }],
  params: [],
  stochastic: false,
}

/** Lightweight shape for pure trust-helper unit tests. */
export function trustNode(
  id: string,
  type: string,
  code?: string,
): CustomCodeNodeLike {
  return {
    id,
    data: {
      type,
      label: type === 'custom_python' ? 'Custom Python' : type,
      params: code === undefined ? {} : { code },
    },
  }
}

/** Full pipeline node for store / UI tests. */
export function pipelineCustomNode(
  code: string,
  id = 'custom-1',
): Node<GraphNodeData> {
  return {
    id,
    type: 'pipeline',
    position: { x: 0, y: 0 },
    data: {
      type: 'custom_python',
      label: 'Custom Python',
      category: 'script',
      params: { code },
      ports: customPythonMeta.ports,
    },
  }
}

export function resetCustomCodeStore(
  patch: Partial<{
    nodes: Node<GraphNodeData>[]
    trustedCustomCodeHash: string | null
    customCodeTrustDialogOpen: boolean
    pendingRunAfterTrust: boolean
    pendingRunOptions: { targetNodeId?: string } | null
  }> = {},
) {
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    nodeCatalog: [customPythonMeta, loadImageMeta],
    trustedCustomCodeHash: null,
    customCodeTrustDialogOpen: false,
    pendingRunOptions: null,
    pendingRunAfterTrust: false,
    workflowDirty: false,
    ...patch,
  })
}
