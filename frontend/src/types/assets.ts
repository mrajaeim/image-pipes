export type AssetKind = 'external' | 'staged' | 'folder'

export interface AssetFile {
  name: string
  path: string
}

export interface AssetBatch {
  id: string
  kind: AssetKind
  files: AssetFile[]
  root?: string | null
}

export interface RegisterAssetsResponse {
  batch: AssetBatch
  count: number
}

export interface UploadResponse {
  path: string
  kind: string
  files: string[]
  count: number
  asset_batch_id: string
}

export interface DesktopOpenResult {
  canceled: boolean
  paths: string[]
}

export interface DesktopFolderResult {
  canceled: boolean
  path: string | null
}

export interface ImagePipesDesktop {
  isDesktop: true
  platform: string
  openImages: () => Promise<DesktopOpenResult>
  openFolder: () => Promise<DesktopFolderResult>
  pickFolder: () => Promise<DesktopFolderResult>
  revealInFolder: (targetPath: string) => Promise<void>
}

declare global {
  interface Window {
    imagePipesDesktop?: ImagePipesDesktop
  }
}

export {}
