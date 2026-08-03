import { Box, Button, TextField, Typography } from '@mui/material'
import { getDesktop, isDesktopApp } from '../../api/assets'
import { notifyError } from '../../notify'

const SAVE_PATH_TEMPLATES = [
  { token: '{filename}', hint: 'source stem' },
  { token: '{time}', hint: 'YYYYmmdd_HHMMSS' },
  { token: '{index}', hint: 'sample index' },
] as const

type SaveImageParamsProps = {
  filename: string
  outputDir: string
  onFilenameChange: (filename: string) => void
  onOutputDirChange: (outputDir: string) => void
}

export function SaveImageParams({
  filename,
  outputDir,
  onFilenameChange,
  onOutputDirChange,
}: SaveImageParamsProps) {
  const desktop = isDesktopApp()

  const insertTemplate = (token: string) => {
    onFilenameChange(`${filename}${token}`)
  }

  const pickFolder = async () => {
    const bridge = getDesktop()
    if (!bridge) return
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
        {desktop
          ? 'Pick an output folder to write images after Run. Leave empty to fall back to a ZIP download.'
          : 'After Run, images are packed into a ZIP and downloaded. Set an output folder when running on desktop.'}
      </Typography>

      <Box sx={{ display: 'grid', gap: 1 }}>
        <TextField
          size="small"
          label="Output folder"
          value={outputDir}
          onChange={(event) => onOutputDirChange(event.target.value)}
          helperText={desktop ? 'Required for direct disk writes' : 'Optional on desktop builds'}
        />
        {desktop && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => void pickFolder()}
            sx={{ textTransform: 'none', justifySelf: 'start' }}
          >
            Choose folder
          </Button>
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
