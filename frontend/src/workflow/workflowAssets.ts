/** Collect / restore asset registry entries embedded in workflow exports. */

import {
  assetPreviewUrl,
  batchFilePaths,
  batchPreviewUrls,
  registerLocalPaths,
  uploadImageFiles,
} from '../api/assets'
import type { AssetBatch } from '../types'
import type {
  WorkflowAssetBatch,
  WorkflowAssetFile,
  WorkflowAssets,
  WorkflowDocument,
} from './io'

function referencedBatchIds(doc: WorkflowDocument): string[] {
  const ids = new Set<string>()
  for (const node of doc.graph.nodes) {
    if (node.type !== 'load_image') continue
    const batchId = String(node.params.asset_batch_id ?? '').trim()
    if (batchId) ids.add(batchId)
  }
  return [...ids]
}

/** Drop legacy load_image.path from all nodes. */
export function stripLegacyLoadPaths(doc: WorkflowDocument): WorkflowDocument {
  return {
    ...doc,
    graph: {
      ...doc.graph,
      nodes: doc.graph.nodes.map((node) => {
        if (node.type !== 'load_image') return node
        const params = { ...node.params }
        delete params.path
        return { ...node, params }
      }),
    },
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function fetchBatch(batchId: string): Promise<AssetBatch> {
  const response = await fetch(`/api/assets/${batchId}`)
  if (!response.ok) {
    throw new Error(`Could not read asset batch ${batchId}`)
  }
  const payload = (await response.json()) as { batch?: AssetBatch } | AssetBatch
  if (payload && typeof payload === 'object' && 'batch' in payload && payload.batch) {
    return payload.batch
  }
  return payload as AssetBatch
}

async function embedBatch(batchId: string): Promise<WorkflowAssetBatch> {
  const batch = await fetchBatch(batchId)
  const sourceFiles = Array.isArray(batch.files) ? batch.files : []
  if (sourceFiles.length === 0) {
    throw new Error(`Asset batch ${batchId} has no files to export`)
  }
  const files: WorkflowAssetFile[] = []
  for (const file of sourceFiles) {
    const response = await fetch(assetPreviewUrl(batchId, file.name))
    if (!response.ok) {
      throw new Error(`Could not read asset file ${file.name}`)
    }
    const buffer = await response.arrayBuffer()
    files.push({
      name: file.name,
      path: file.path,
      content_b64: arrayBufferToBase64(buffer),
    })
  }
  return {
    kind: batch.kind,
    root: batch.root ?? null,
    files,
  }
}

/** Attach referenced registry batches (with file bytes) and strip legacy path. */
export async function buildExportDocument(
  doc: WorkflowDocument,
): Promise<WorkflowDocument> {
  const cleaned = stripLegacyLoadPaths(doc)
  const assets: WorkflowAssets = {}
  for (const batchId of referencedBatchIds(cleaned)) {
    assets[batchId] = await embedBatch(batchId)
  }
  if (Object.keys(assets).length === 0) {
    return omitAssets(cleaned)
  }
  return { ...omitAssets(cleaned), assets }
}

async function importBatch(
  batch: WorkflowAssetBatch,
): Promise<{ batchId: string; previewUrls: string[]; filePaths: string[] }> {
  const withContent = batch.files.filter((file) => file.content_b64)
  if (withContent.length > 0) {
    const files = withContent.map((file) => {
      const bytes = base64ToUint8Array(file.content_b64!)
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      return new File([copy], file.name)
    })
    const result = await uploadImageFiles(files, {
      asFolder: batch.kind === 'folder' || files.length > 1,
    })
    const registered = await fetchBatch(result.asset_batch_id)
    return {
      batchId: result.asset_batch_id,
      previewUrls: batchPreviewUrls(registered),
      filePaths: batchFilePaths(registered),
    }
  }

  const paths = batch.files
    .map((file) => file.path?.trim())
    .filter((path): path is string => Boolean(path))
  if (paths.length === 0 && batch.root?.trim()) {
    paths.push(batch.root.trim())
  }
  if (paths.length === 0) {
    throw new Error('Embedded asset batch has no file content or paths')
  }
  const result = await registerLocalPaths(paths, {
    asFolder: batch.kind === 'folder' || paths.length > 1,
  })
  return {
    batchId: result.batch.id,
    previewUrls: batchPreviewUrls(result.batch),
    filePaths: batchFilePaths(result.batch),
  }
}

function omitAssets(doc: WorkflowDocument): WorkflowDocument {
  if (!('assets' in doc)) return doc
  const next = { ...doc }
  delete next.assets
  return next
}

export type RehydratedAssets = {
  doc: WorkflowDocument
  /** new batch id → preview urls / files for local canvas thumbnails */
  previews: Record<string, { urls: string[]; files: string[] }>
}

/** Re-register embedded assets and remap load_image asset_batch_id values. */
export async function rehydrateWorkflowAssets(
  doc: WorkflowDocument,
): Promise<RehydratedAssets> {
  const embedded = doc.assets
  const cleaned = stripLegacyLoadPaths(doc)
  if (!embedded || Object.keys(embedded).length === 0) {
    return { doc: omitAssets(cleaned), previews: {} }
  }

  const idMap = new Map<string, string>()
  const previews: RehydratedAssets['previews'] = {}
  for (const [oldId, batch] of Object.entries(embedded)) {
    const imported = await importBatch(batch)
    idMap.set(oldId, imported.batchId)
    previews[imported.batchId] = {
      urls: imported.previewUrls,
      files: imported.filePaths,
    }
  }

  const nodes = cleaned.graph.nodes.map((node) => {
    if (node.type !== 'load_image') return node
    const params = { ...node.params }
    delete params.path
    const oldId = String(params.asset_batch_id ?? '').trim()
    if (oldId && idMap.has(oldId)) {
      params.asset_batch_id = idMap.get(oldId)
    }
    return { ...node, params }
  })

  return {
    doc: {
      ...omitAssets(cleaned),
      graph: { ...cleaned.graph, nodes },
    },
    previews,
  }
}
