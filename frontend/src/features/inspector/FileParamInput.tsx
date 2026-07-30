import { useEffect, useRef, useState } from 'react'
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import type { ParamField } from '../../types'

interface FileParamInputProps {
  field: ParamField
  value: string
  previewUrls?: string[]
  onChange: (path: string) => void
  onPreviews?: (dataUrls: string[], uploadedFiles: string[]) => void
  onRemovePreview?: (index: number) => void
  onBatchCount?: (count: number) => void
}

interface UploadResponse {
  path: string
  kind: string
  files: string[]
  count: number
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

async function uploadFiles(files: File[], asFolder: boolean): Promise<UploadResponse> {
  const body = new FormData()
  for (const file of files) {
    body.append('files', file, file.name)
  }
  const response = await fetch(`/api/uploads?as_folder=${asFolder ? 'true' : 'false'}`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Upload failed')
  }
  return response.json() as Promise<UploadResponse>
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
  previewUrls = [],
  onChange,
  onPreviews,
  onRemovePreview,
  onBatchCount,
}: FileParamInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const handleFiles = async (fileList: FileList | null, asFolder: boolean) => {
    const files = filterImageFiles(fileList, field).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
    if (files.length === 0) {
      setError(`No supported images selected (${acceptAttr(field)})`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
      const batch = asFolder || files.length > 1
      const result = await uploadFiles(files, batch)
      onPreviews?.(urls, result.files)
      onChange(result.path)
      onBatchCount?.(result.count)
    } catch (err) {
      onPreviews?.([], [])
      setError(err instanceof Error ? err.message : 'Upload failed')
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
        helperText={field.description ?? `Allowed: ${acceptAttr(field)}`}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Choose images
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => folderRef.current?.click()}
        >
          Choose folder
        </Button>
      </Stack>
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        accept={acceptAttr(field)}
        onChange={(event) => {
          void handleFiles(event.target.files, false)
          event.target.value = ''
        }}
      />
      <input
        ref={folderRef}
        type="file"
        hidden
        multiple
        onChange={(event) => {
          void handleFiles(event.target.files, true)
          event.target.value = ''
        }}
      />
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
