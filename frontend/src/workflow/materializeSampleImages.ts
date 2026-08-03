/** Turn template placeholder paths like examples/lena.png into real uploads. */

import { useGraphStore } from '../store/graphStore'

function isExamplePlaceholder(path: string): boolean {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').startsWith('examples/')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read sample image'))
    reader.readAsDataURL(blob)
  })
}

/**
 * For Load Image nodes that still point at examples/..., download the bundled
 * sample via /api/sample-image and attach it like a normal file pick.
 */
export async function materializeSampleImages(): Promise<void> {
  const { nodes, updateNodeParams, setLocalPreviews } = useGraphStore.getState()
  const targets = nodes.filter(
    (node) =>
      node.data.type === 'load_image' &&
      isExamplePlaceholder(String(node.data.params.path ?? '')),
  )
  if (targets.length === 0) return

  const response = await fetch('/api/sample-image')
  if (!response.ok) {
    throw new Error('Could not load sample image')
  }
  const blob = await response.blob()
  const file = new File([blob], 'lena.png', { type: 'image/png' })
  const dataUrl = await blobToDataUrl(blob)

  for (const node of targets) {
    const body = new FormData()
    body.append('files', file)
    const upload = await fetch('/api/uploads?as_folder=false', {
      method: 'POST',
      body,
    })
    if (!upload.ok) {
      throw new Error('Could not stage sample image')
    }
    const result = (await upload.json()) as { path: string; files: string[] }
    updateNodeParams(node.id, { path: result.path })
    setLocalPreviews(node.id, [dataUrl], result.files)
  }
}
