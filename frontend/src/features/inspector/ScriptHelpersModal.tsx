import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import {
  SCRIPT_HELPERS,
  SCRIPT_HELPERS_FOOTNOTE,
  SCRIPT_HELPERS_TAGLINE,
} from './scriptHelpersHint'

type ScriptHelpersModalProps = {
  open: boolean
  onClose: () => void
}

export function ScriptHelpersModal({ open, onClose }: ScriptHelpersModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="nokey"
      slotProps={{
        paper: {
          className: 'nokey',
          sx: {
            bgcolor: '#161616',
            color: '#f4f1ea',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(93,173,226,0.12), transparent 55%)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          pb: 0.5,
        }}
      >
        Script helpers
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgba(244,241,234,0.55)', fontSize: 13, mb: 2 }}>
          {SCRIPT_HELPERS_TAGLINE}
        </Typography>

        <Stack spacing={1.75} sx={{ mb: 2.5 }}>
          {SCRIPT_HELPERS.map((helper) => (
            <Box
              key={helper.signature}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.03)',
              }}
            >
              <Typography
                component="code"
                sx={{
                  display: 'block',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 13,
                  fontWeight: 650,
                  color: '#5dade2',
                  mb: 0.5,
                }}
              >
                {helper.signature}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                {helper.summary}
              </Typography>
              <Typography sx={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(244,241,234,0.6)' }}>
                {helper.detail}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Typography
          sx={{
            fontSize: 12,
            color: 'rgba(244,241,234,0.4)',
            lineHeight: 1.5,
          }}
        >
          {SCRIPT_HELPERS_FOOTNOTE}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#e67e22',
            color: '#0f0f0f',
            '&:hover': { bgcolor: '#f39c12' },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
