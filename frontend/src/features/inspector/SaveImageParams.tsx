import { Box, Button, TextField, Typography } from '@mui/material'

const SAVE_PATH_TEMPLATES = [
  { token: '{filename}', hint: 'source stem' },
  { token: '{time}', hint: 'YYYYmmdd_HHMMSS' },
  { token: '{index}', hint: 'sample index' },
] as const

type SaveImageParamsProps = {
  filename: string
  onFilenameChange: (filename: string) => void
}

export function SaveImageParams({ filename, onFilenameChange }: SaveImageParamsProps) {
  const insertTemplate = (token: string) => {
    onFilenameChange(`${filename}${token}`)
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.55)', lineHeight: 1.45 }}>
        After Run, images are packed into a ZIP and your browser downloads it. No local folder
        access is required.
      </Typography>

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
