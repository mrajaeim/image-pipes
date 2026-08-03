/** Desktop bridge + asset/upload HTTP helpers. */

import type {
  AssetBatch,
  RegisterAssetsResponse,
  UploadResponse,
} from '../types'

export function isDesktopApp(): boolean {
  return Boolean(window.imagePipesDesktop?.isDesktop)
}

export function getDesktop() {
  return window.imagePipesDesktop
}

export function assetPreviewUrl(batchId: string, name: string): string {
  return `/api/assets/${batchId}/files/${encodeURIComponent(name)}`
}

export async function registerLocalPaths(
  paths: string[],
  options?: { asFolder?: boolean; appendTo?: string },
): Promise<RegisterAssetsResponse> {
  const response = await fetch('/api/assets/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paths,
      as_folder: Boolean(options?.asFolder),
      append_to: options?.appendTo ?? null,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Could not register images')
  }
  return response.json() as Promise<RegisterAssetsResponse>
}

export async function uploadImageFiles(
  files: File[],
  options?: { asFolder?: boolean; appendTo?: string },
): Promise<UploadResponse> {
  const body = new FormData()
  for (const file of files) {
    body.append('files', file, file.name)
  }
  const params = new URLSearchParams({
    as_folder: options?.asFolder ? 'true' : 'false',
  })
  if (options?.appendTo) params.set('append_to', options.appendTo)
  const response = await fetch(`/api/uploads?${params.toString()}`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Upload failed')
  }
  return response.json() as Promise<UploadResponse>
}

export async function deleteUploadedPath(path: string): Promise<void> {
  await fetch(`/api/uploads?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function deleteAssetFile(batchId: string, name: string): Promise<void> {
  await fetch(`/api/assets/${batchId}/files/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export function batchDisplayPath(batch: AssetBatch): string {
  if (batch.root) return batch.root
  if (batch.files.length === 1) return batch.files[0].path
  if (batch.files.length > 1) {
    const parent = batch.files[0].path.replace(/[\\/][^\\/]+$/, '')
    return parent || batch.id
  }
  return ''
}

export function batchPreviewUrls(batch: AssetBatch): string[] {
  return batch.files.map((file) => assetPreviewUrl(batch.id, file.name))
}

export function batchFilePaths(batch: AssetBatch): string[] {
  return batch.files.map((file) => file.path)
}
