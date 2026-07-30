import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../store/graphStore'

const fieldSx = {
  width: 92,
  '& .MuiInputBase-root': {
    color: '#f0ebe3',
    bgcolor: '#0f0f0f',
    borderRadius: 1.25,
    fontSize: 13,
    height: 36,
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(244,241,234,0.45)',
    fontSize: 12,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'rgba(125,206,160,0.85)',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.18)',
  },
  '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(125,206,160,0.5)',
  },
} as const

function BrandMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        borderRadius: 1.25,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#0c0c0c',
        border: '1px solid rgba(255,255,255,0.12)',
        flexShrink: 0,
        backgroundImage:
          'linear-gradient(135deg, rgba(125,206,160,0.35), transparent 55%), linear-gradient(315deg, rgba(230,126,34,0.4), transparent 50%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 6,
          borderRadius: 0.75,
          border: '1.5px solid rgba(244,241,234,0.75)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: '#7dcea0',
          left: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: '#e67e22',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </Box>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 0.6,
        px: 1,
        py: 0.55,
        borderRadius: 1.25,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(244,241,234,0.4)',
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f4f1ea', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}

interface AppHeaderProps {
  onRun: () => void
  onCancel: () => void
  onExport: () => void
}

export function AppHeader({ onRun, onCancel, onExport }: AppHeaderProps) {
  const seed = useGraphStore((s) => s.seed)
  const sampleCount = useGraphStore((s) => s.sampleCount)
  const setSeed = useGraphStore((s) => s.setSeed)
  const setSampleCount = useGraphStore((s) => s.setSampleCount)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const nodeCount = useGraphStore((s) => s.nodes.length)
  const edgeCount = useGraphStore((s) => s.edges.length)

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.1,
        minHeight: 58,
        bgcolor: '#121212',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.03), transparent), radial-gradient(ellipse 50% 120% at 0% 0%, rgba(125,206,160,0.08), transparent 55%)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <BrandMark />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1.1,
              color: '#f4f1ea',
              letterSpacing: '-0.02em',
            }}
          >
            Image Pipes
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              color: 'rgba(244,241,234,0.45)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            OpenCV pipeline playground
          </Typography>
        </Box>
      </Stack>

      <Stack
        direction="row"
        spacing={0.75}
        sx={{ display: { xs: 'none', md: 'flex' }, ml: 1 }}
      >
        <StatPill label="Nodes" value={nodeCount} />
        <StatPill label="Links" value={edgeCount} />
      </Stack>

      <Box sx={{ flex: 1 }} />

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 1,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <TextField
          size="small"
          label="Seed"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          sx={fieldSx}
        />
        <TextField
          size="small"
          label="Samples"
          type="number"
          value={sampleCount}
          onChange={(e) => setSampleCount(Math.max(1, Number(e.target.value) || 1))}
          sx={fieldSx}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        {isExecuting ? (
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{
              height: 36,
              px: 1.75,
              borderRadius: 1.25,
              textTransform: 'none',
              fontWeight: 700,
              color: '#ff8a80',
              borderColor: 'rgba(255,138,128,0.35)',
              '&:hover': {
                borderColor: 'rgba(255,138,128,0.6)',
                bgcolor: 'rgba(192,57,43,0.12)',
              },
            }}
          >
            Cancel
          </Button>
        ) : null}

        <Button
          variant="contained"
          disabled={isExecuting}
          onClick={onRun}
          sx={{
            height: 36,
            px: 2.25,
            borderRadius: 1.25,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 13,
            bgcolor: isExecuting ? '#5a4a3a' : '#e67e22',
            color: '#0f0f0f',
            boxShadow: isExecuting ? 'none' : '0 0 0 1px rgba(230,126,34,0.35), 0 8px 20px rgba(230,126,34,0.22)',
            '&:hover': { bgcolor: '#f39c12' },
            '&.Mui-disabled': {
              bgcolor: 'rgba(230,126,34,0.35)',
              color: 'rgba(15,15,15,0.7)',
            },
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {isExecuting ? (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#0f0f0f',
                  animation: 'pulse 1s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.35 },
                    '50%': { opacity: 1 },
                  },
                }}
              />
            ) : (
              <Box component="span" sx={{ fontSize: 11, lineHeight: 1 }}>
                ▶
              </Box>
            )}
            {isExecuting ? 'Running…' : 'Run'}
          </Box>
        </Button>

        <Button
          variant="outlined"
          disabled={isExecuting}
          onClick={onExport}
          sx={{
            height: 36,
            px: 1.75,
            borderRadius: 1.25,
            textTransform: 'none',
            fontWeight: 650,
            color: '#f0ebe3',
            borderColor: 'rgba(255,255,255,0.16)',
            '&:hover': {
              borderColor: 'rgba(125,206,160,0.45)',
              bgcolor: 'rgba(125,206,160,0.08)',
            },
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.3)',
              borderColor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          Export Python
        </Button>
      </Stack>
    </Box>
  )
}
