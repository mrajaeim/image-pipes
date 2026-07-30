import { useEffect, useRef, useState } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import type { ParamField } from '../../types'

interface FileParamInputProps {
  field: ParamField
  value: string
  onChange: (path: string) => void
  onPreviews?: (dataUrls: string[]) => void
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
  onChange,
  onPreviews,
  onBatchCount,
}: FileParamInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

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
      if (onPreviews) {
        const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
        onPreviews(urls)
      }
      const batch = asFolder || files.length > 1
      const result = await uploadFiles(files, batch)
      onChange(result.path)
      onBatchCount?.(result.count)
      setSummary(
        result.count > 1
          ? `${result.count} images selected`
          : `1 image selected · ${files[0]?.name ?? 'image'}`,
      )
    } catch (err) {
      onPreviews?.([])
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
