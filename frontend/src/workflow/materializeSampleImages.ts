/** Turn template placeholder paths like examples/lena.png into real asset refs. */

import {
  batchDisplayPath,
  batchFilePaths,
  batchPreviewUrls,
} from '../api/assets'
import { useGraphStore } from '../store/graphStore'
import type { RegisterAssetsResponse } from '../types'

function isExamplePlaceholder(path: string): boolean {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').startsWith('examples/')
}

/**
 * For Load Image nodes that still point at examples/..., register the bundled
 * sample via /api/assets/sample (no FormData copy).
 */
export async function materializeSampleImages(): Promise<void> {
  const { nodes, updateNodeParams, setLocalPreviews } = useGraphStore.getState()
  const targets = nodes.filter(
    (node) =>
      node.data.type === 'load_image' &&
      isExamplePlaceholder(String(node.data.params.path ?? '')),
  )
  if (targets.length === 0) return

  const response = await fetch('/api/assets/sample', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Could not stage sample image')
  }
  const result = (await response.json()) as RegisterAssetsResponse
  const path = batchDisplayPath(result.batch)
  const urls = batchPreviewUrls(result.batch)
  const files = batchFilePaths(result.batch)

  for (const node of targets) {
    // Share one registered batch across all example Load Image nodes.
    updateNodeParams(node.id, {
      path,
      asset_batch_id: result.batch.id,
    })
    setLocalPreviews(node.id, urls, files)
  }
}
