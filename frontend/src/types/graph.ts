export type PortDirection = 'input' | 'output'

export interface PortSpec {
  id: string
  name: string
  direction: PortDirection
  data_type: string
  multiple: boolean
  optional?: boolean
}

export interface ParamField {
  name: string
  label: string
  type: string
  default?: unknown
  minimum?: number | null
  maximum?: number | null
  step?: number | null
  options?: string[] | null
  accept?: string[] | null
  description?: string | null
}

export interface NodeMetadata {
  type: string
  label: string
  category: string
  description: string
  ports: PortSpec[]
  params: ParamField[]
  stochastic: boolean
}

export interface GraphNodeData {
  type: string
  label: string
  params: Record<string, unknown>
  category: string
  ports: PortSpec[]
  active?: boolean
  /** Local previews for Load Images before execution */
  localPreviewUrls?: string[]
  /** Server paths for each local preview (same order as localPreviewUrls) */
  uploadedFiles?: string[]
  [key: string]: unknown
}

export interface ExecutionPreview {
  nodeId: string
  sampleIndex: number
  imageB64: string
  portId?: string | null
  cacheHit?: boolean | null
  data?: Record<string, unknown> | null
}

export type ExecutionEventType =
  | 'progress'
  | 'preview'
  | 'log'
  | 'error'
  | 'done'
  | 'cancelled'
  | 'download'

export interface ExecutionEvent {
  type: ExecutionEventType
  node_id?: string | null
  port_id?: string | null
  message?: string | null
  progress?: number | null
  image_b64?: string | null
  sample_index?: number | null
  cache_hit?: boolean | null
  duration_ms?: number | null
  data?: Record<string, unknown> | null
  download_url?: string | null
  download_filename?: string | null
}
