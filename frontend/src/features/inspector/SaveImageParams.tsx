import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { getDesktop, isDesktopApp } from '../../api/assets'
import { notifyError } from '../../notify'

const SAVE_PATH_TEMPLATES = [
  { token: '{filename}', hint: 'source stem' },
  { token: '{time}', hint: 'YYYYmmdd_HHMMSS' },
  { token: '{index}', hint: 'sample index' },
] as const

const PACKAGING_OPTIONS = [
  { value: 'bare', label: 'Bare files' },
  { value: 'zip', label: 'ZIP archive' },
] as const

export type SavePackaging = 'bare' | 'zip'

type SaveImageParamsProps = {
  filename: string
  outputDir: string
  packaging: SavePackaging
  onFilenameChange: (filename: string) => void
  onOutputDirChange: (outputDir: string) => void
  onPackagingChange: (packaging: SavePackaging) => void
}

export function SaveImageParams({
  filename,
  outputDir,
  packaging,
  onFilenameChange,
  onOutputDirChange,
  onPackagingChange,
}: SaveImageParamsProps) {
  const desktop = isDesktopApp()
  const hasFolder = Boolean(outputDir.trim())

  const insertTemplate = (token: string) => {
    onFilenameChange(`${filename}${token}`)
  }

  const pickFolder = async () => {
    const bridge = getDesktop()
    if (!bridge) {
      notifyError('Folder selection requires the desktop app')
      return
    }
    try {
      const result = await bridge.pickFolder()
      if (result.canceled || !result.path) return
      onOutputDirChange(result.path)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Could not pick folder')
    }
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.55)', lineHeight: 1.45 }}>
        Choose bare files or a ZIP, then optionally pick a destination folder. Default is the
        workflow output folder.
      </Typography>

      <TextField
        select
        size="small"
        label="Packaging"
        value={packaging}
        onChange={(event) => {
          const next = event.target.value === 'zip' ? 'zip' : 'bare'
          onPackagingChange(next)
        }}
        helperText={
          packaging === 'zip'
            ? 'Images are packed into one ZIP under the destination folder'
            : 'Each image is written as a separate file'
        }
      >
        {PACKAGING_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(244,241,234,0.4)',
          }}
        >
          Output folder
        </Typography>
        <Box
          title={hasFolder ? outputDir : 'output'}
          sx={{
            px: 1.25,
            py: 1,
            borderRadius: 1.25,
            bgcolor: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.1)',
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              color: hasFolder ? '#f0ebe3' : 'rgba(244,241,234,0.45)',
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.4,
              wordBreak: 'break-all',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            {hasFolder ? outputDir : 'output (default)'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void pickFolder()}
            sx={{ textTransform: 'none' }}
          >
            {hasFolder ? 'Change folder' : 'Choose folder'}
          </Button>
          {hasFolder && (
            <Button
              size="small"
              variant="text"
              onClick={() => onOutputDirChange('')}
              sx={{ textTransform: 'none', color: 'rgba(244,241,234,0.55)' }}
            >
              Use default
            </Button>
          )}
        </Box>
        {!desktop && (
          <Typography sx={{ fontSize: 12, color: 'rgba(244,241,234,0.4)', lineHeight: 1.4 }}>
            Folder selection needs the desktop app. Without it, saves use the default output
            folder.
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
