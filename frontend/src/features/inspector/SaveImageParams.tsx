import { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { notifyError, notifySuccess } from '../../notify'

const SAVE_PATH_TEMPLATES = [
  { token: '{filename}', hint: 'source stem' },
  { token: '{time}', hint: 'YYYYmmdd_HHMMSS' },
  { token: '{index}', hint: 'sample index' },
] as const

type SaveImageParamsProps = {
  directory: string
  filename: string
  onDirectoryChange: (directory: string) => void
  onFilenameChange: (filename: string) => void
}

export function SaveImageParams({
  directory,
  filename,
  onDirectoryChange,
  onFilenameChange,
}: SaveImageParamsProps) {
  const [busy, setBusy] = useState(false)
  const folderLabel = directory
    ? directory.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? directory
    : null

  const chooseFolder = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/outputs', { method: 'POST' })
      if (!response.ok) {
        throw new Error((await response.text()) || 'Could not create output folder')
      }
      const body = (await response.json()) as { path: string; name: string }
      onDirectoryChange(body.path)
      notifySuccess(`Output folder ready: ${body.name}`)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Folder selection failed')
    } finally {
      setBusy(false)
    }
  }

  const insertTemplate = (token: string) => {
    onFilenameChange(`${filename}${token}`)
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(244,241,234,0.4)',
          }}
        >
          Output folder (required)
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => void chooseFolder()}
            sx={{ textTransform: 'none' }}
          >
            {directory ? 'Change folder' : 'Choose folder'}
          </Button>
          <Typography
            sx={{
              fontSize: 12,
              color: directory ? 'rgba(244,241,234,0.75)' : '#ff8a80',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              wordBreak: 'break-all',
            }}
          >
            {directory ? folderLabel : 'No folder selected'}
          </Typography>
        </Box>
        {directory && (
          <Typography
            sx={{
              fontSize: 11,
              color: 'rgba(244,241,234,0.4)',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
            title={directory}
          >
            {directory}
          </Typography>
        )}
      </Box>

      <TextField
        size="small"
        label="Filename"
        value={filename}
        onChange={(event) => onFilenameChange(event.target.value)}
        helperText="Templates: {filename}, {time}, {index}"
      />

      <Box>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(244,241,234,0.4)',
            mb: 0.5,
          }}
        >
          Available templates
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {SAVE_PATH_TEMPLATES.map((item) => (
            <Button
              key={item.token}
              size="small"
              variant="outlined"
              onClick={() => insertTemplate(item.token)}
              sx={{
                textTransform: 'none',
                minWidth: 0,
                px: 1,
                py: 0.25,
                borderColor: 'rgba(125,206,160,0.35)',
                color: '#7dcea0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 11,
                '&:hover': {
                  borderColor: 'rgba(125,206,160,0.6)',
                  bgcolor: 'rgba(125,206,160,0.08)',
                },
              }}
              title={item.hint}
            >
              {item.token}
              <Box
                component="span"
                sx={{
                  ml: 0.75,
                  color: 'rgba(244,241,234,0.4)',
                  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {item.hint}
              </Box>
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
