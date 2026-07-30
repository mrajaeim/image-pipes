import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { PROJECT_INFO } from '../projectInfo'

interface ProjectInfoModalProps {
  open: boolean
  onClose: () => void
}

export function ProjectInfoModal({ open, onClose }: ProjectInfoModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#161616',
            color: '#f4f1ea',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(125,206,160,0.1), transparent 55%)',
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
        {PROJECT_INFO.name}
      </DialogTitle>
      <DialogContent>
        <Typography
          sx={{ color: 'rgba(244,241,234,0.55)', fontSize: 13, mb: 2 }}
        >
          {PROJECT_INFO.tagline}
        </Typography>
        <Typography sx={{ fontSize: 14, lineHeight: 1.6, mb: 2.5 }}>
          {PROJECT_INFO.description}
        </Typography>

        <Stack spacing={1.5}>
          <Box>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(244,241,234,0.4)',
                mb: 0.4,
              }}
            >
              License
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {PROJECT_INFO.licenseLabel}
            </Typography>
          </Box>

          <Box>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(244,241,234,0.4)',
                mb: 0.4,
              }}
            >
              GitHub
            </Typography>
            <Link
              href={PROJECT_INFO.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#7dcea0',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {PROJECT_INFO.githubLabel}
            </Link>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          href={PROJECT_INFO.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          sx={{
            textTransform: 'none',
            fontWeight: 650,
            color: '#f0ebe3',
            borderColor: 'rgba(255,255,255,0.16)',
            '&:hover': {
              borderColor: 'rgba(125,206,160,0.45)',
              bgcolor: 'rgba(125,206,160,0.08)',
            },
          }}
        >
          Open GitHub
        </Button>
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
