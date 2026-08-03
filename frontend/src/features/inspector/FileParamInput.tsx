import { useEffect, useRef, useState } from 'react'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import {
  batchDisplayPath,
  batchFilePaths,
  batchPreviewUrls,
  isDesktopApp,
  getDesktop,
  registerLocalPaths,
  uploadImageFiles,
} from '../../api/assets'
import type { ParamField } from '../../types'
import { notifyError, notifySuccess } from '../../notify'

interface FileParamInputProps {
  field: ParamField
  value: string
  assetBatchId?: string
  previewUrls?: string[]
  uploadedFiles?: string[]
  onChange: (path: string) => void
  onAssetBatchId?: (batchId: string) => void
  onPreviews?: (dataUrls: string[], uploadedFiles: string[]) => void
  onRemovePreview?: (index: number) => void
}

function acceptAttr(field: ParamField): string {
  const extensions = field.accept?.length
    ? field.accept
    : ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp', '.gif']
  return extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`)).join(',')
}

function filterImageFiles(fileList: FileList | null, field: ParamField): File[] {
  if (!fileList) return []
  const allowed = new Set(
    (field.accept?.length
      ? field.accept
      : ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp', '.gif']
    ).map((ext) => ext.toLowerCase().replace(/^\./, '')),
  )
  return Array.from(fileList).filter((file) => {
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    return allowed.has(ext)
  })
}

function parentDir(filePath: string): string {
  return filePath.replace(/[\\/][^\\/]+$/, '')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image preview'))
    reader.readAsDataURL(file)
  })
}

export function FileParamInput({
  field,
  value,
  assetBatchId = '',
  previewUrls = [],
  uploadedFiles = [],
  onChange,
  onAssetBatchId,
  onPreviews,
  onRemovePreview,
}: FileParamInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const desktop = isDesktopApp()
  const summary =
    previewUrls.length > 1
      ? `${previewUrls.length} images selected`
      : previewUrls.length === 1
        ? '1 image selected'
        : null

  useEffect(() => {
    const input = folderRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  const applyBatch = (
    batchId: string,
    path: string,
    urls: string[],
    files: string[],
    message: string,
  ) => {
    onAssetBatchId?.(batchId)
    onChange(path)
    onPreviews?.(urls, files)
    notifySuccess(message)
  }

  const handleDesktopPick = async (mode: 'replace' | 'append' | 'folder') => {
    const bridge = getDesktop()
    if (!bridge) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'folder') {
        const picked = await bridge.openFolder()
        if (picked.canceled || !picked.path) return
        const result = await registerLocalPaths([picked.path], { asFolder: true })
        applyBatch(
          result.batch.id,
          batchDisplayPath(result.batch),
          batchPreviewUrls(result.batch),
          batchFilePaths(result.batch),
          result.count > 1 ? `${result.count} images loaded` : 'Image loaded',
        )
        return
      }

      const picked = await bridge.openImages()
      if (picked.canceled || picked.paths.length === 0) return
      const appending = mode === 'append' && Boolean(assetBatchId)
      const result = await registerLocalPaths(picked.paths, {
        asFolder: picked.paths.length > 1,
        appendTo: appending ? assetBatchId : undefined,
      })
      applyBatch(
        result.batch.id,
        batchDisplayPath(result.batch),
        batchPreviewUrls(result.batch),
        batchFilePaths(result.batch),
        appending
          ? `Images updated (${result.batch.files.length} total)`
          : result.count > 1
            ? `${result.count} images loaded`
            : 'Image loaded',
      )
    } catch (err) {
      if (mode === 'replace' || mode === 'folder') onPreviews?.([], [])
      const message = err instanceof Error ? err.message : 'Could not open images'
      setError(message)
      notifyError(message)
    } finally {
      setBusy(false)
    }
  }

  const handleFiles = async (
    fileList: FileList | null,
    asFolder: boolean,
    mode: 'replace' | 'append',
  ) => {
    const files = filterImageFiles(fileList, field).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
    if (files.length === 0) {
      const message = `No supported images selected (${acceptAttr(field)})`
      setError(message)
      notifyError(message)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
      const appending = mode === 'append' && uploadedFiles.length > 0
      const appendTo = appending ? parentDir(uploadedFiles[0]) : undefined
      const batch = asFolder || files.length > 1 || appending
      const result = await uploadImageFiles(files, { asFolder: batch, appendTo })
      if (appending) {
        const nextUrls = [...previewUrls, ...urls]
        const nextFiles = [...uploadedFiles, ...result.files]
        onAssetBatchId?.(result.asset_batch_id)
        onPreviews?.(nextUrls, nextFiles)
        onChange(result.path)
        notifySuccess(
          result.count > 1
            ? `Added ${result.count} images (${nextUrls.length} total)`
            : `Added image (${nextUrls.length} total)`,
        )
      } else {
        onAssetBatchId?.(result.asset_batch_id)
        onPreviews?.(urls, result.files)
        onChange(result.path)
        notifySuccess(
          result.count > 1 ? `${result.count} images loaded` : 'Image loaded',
        )
      }
    } catch (err) {
      if (mode === 'replace') onPreviews?.([], [])
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      notifyError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <TextField
        size="small"
        label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        helperText={
          desktop
            ? 'Native file dialogs register local paths (no copy).'
            : (field.description ?? `Allowed: ${acceptAttr(field)}`)
        }
      />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => {
            if (desktop) void handleDesktopPick('replace')
            else fileRef.current?.click()
          }}
          sx={{ textTransform: 'none' }}
        >
          Choose images
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => {
            if (desktop) void handleDesktopPick('append')
            else addRef.current?.click()
          }}
          sx={{ textTransform: 'none' }}
        >
          Add image
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => {
            if (desktop) void handleDesktopPick('folder')
            else folderRef.current?.click()
          }}
          sx={{ textTransform: 'none' }}
        >
          Choose folder
        </Button>
      </Box>
      {!desktop && (
        <>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept={acceptAttr(field)}
            onChange={(event) => {
              void handleFiles(event.target.files, false, 'replace')
              event.target.value = ''
            }}
          />
          <input
            ref={addRef}
            type="file"
            hidden
            multiple
            accept={acceptAttr(field)}
            onChange={(event) => {
              void handleFiles(event.target.files, false, 'append')
              event.target.value = ''
            }}
          />
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            onChange={(event) => {
              void handleFiles(event.target.files, true, 'replace')
              event.target.value = ''
            }}
          />
        </>
      )}
      {previewUrls.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
            gap: 1,
          }}
        >
          {previewUrls.map((src, index) => (
            <Box
              key={`${index}-${src.slice(0, 24)}`}
              sx={{
                position: 'relative',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: '#0a0a0a',
                aspectRatio: '1',
              }}
            >
              <Box
                component="img"
                src={src}
                alt={`Image ${index + 1}`}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {onRemovePreview && (
                <IconButton
                  size="small"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => onRemovePreview(index)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    bgcolor: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgba(180,40,40,0.9)' },
                  }}
                >
                  ×
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      )}
      {summary && (
        <Typography variant="caption" color="text.secondary">
          {summary}
        </Typography>
      )}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  )
}
