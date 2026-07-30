import { useEffect, useRef, useState } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import type { ParamField } from '../../types'

interface FileParamInputProps {
  field: ParamField
  value: string
  onChange: (path: string) => void
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

export function FileParamInput({ field, value, onChange }: FileParamInputProps) {
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
    const files = filterImageFiles(fileList, field)
    if (files.length === 0) {
      setError(`No supported images selected (${acceptAttr(field)})`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await uploadFiles(files, asFolder)
      onChange(result.path)
      setSummary(
        result.kind === 'folder'
          ? `Folder selected · ${result.count} image${result.count === 1 ? '' : 's'}`
          : `File selected · ${files[0]?.name ?? 'image'}`,
      )
    } catch (err) {
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
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Choose file
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
