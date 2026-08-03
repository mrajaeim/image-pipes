/** Turn template sample markers into real asset refs. */

import { batchFilePaths, batchPreviewUrls } from '../api/assets'
import { useGraphStore } from '../store/graphStore'
import type { RegisterAssetsResponse } from '../types'

function needsSampleImage(params: Record<string, unknown>): boolean {
  const batchId = String(params.asset_batch_id ?? '').trim()
  if (batchId) return false
  const sample = String(params.sample ?? '').trim().toLowerCase()
  if (sample === 'lena') return true
  // Legacy templates used path: examples/...
  const path = String(params.path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
  return path.startsWith('examples/')
}

/**
 * For Load Image nodes that request the bundled sample, register it via
 * /api/assets/sample (no FormData copy).
 */
export async function materializeSampleImages(): Promise<void> {
  const { nodes, updateNodeParams, setLocalPreviews } = useGraphStore.getState()
  const targets = nodes.filter(
    (node) => node.data.type === 'load_image' && needsSampleImage(node.data.params),
  )
  if (targets.length === 0) return

  const response = await fetch('/api/assets/sample', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Could not stage sample image')
  }
  const result = (await response.json()) as RegisterAssetsResponse
  const urls = batchPreviewUrls(result.batch)
  const files = batchFilePaths(result.batch)

  for (const node of targets) {
    // Share one registered batch across all sample Load Image nodes.
    updateNodeParams(node.id, {
      asset_batch_id: result.batch.id,
      sample: 'lena',
    })
    setLocalPreviews(node.id, urls, files)
  }
}
