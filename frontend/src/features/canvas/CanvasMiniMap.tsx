import { useState } from 'react'
import { MiniMap, Panel } from '@xyflow/react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'

const STORAGE_KEY = 'image-pipes.canvasMinimapOpen'

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

const toggleButtonSx = {
  width: 26,
  height: 26,
  borderRadius: 0.75,
  color: 'rgba(244,241,234,0.85)',
  bgcolor: '#2b2b2b',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 0 2px 1px rgba(0,0,0,0.08)',
  '&:hover': { bgcolor: '#3e3e3e' },
} as const

export function CanvasMiniMap() {
  const [open, setOpen] = useState(readStoredOpen)

  const setOpenPersisted = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }

  if (!open) {
    return (
      <Panel position="bottom-right" className="nodrag nopan">
        <Tooltip title="Show map" arrow enterDelay={400}>
          <IconButton
            size="small"
            className="nodrag nopan"
            aria-label="Show map"
            onClick={() => setOpenPersisted(true)}
            sx={toggleButtonSx}
          >
            <Box component="span" sx={{ fontSize: 13, lineHeight: 1 }}>
              ▣
            </Box>
          </IconButton>
        </Tooltip>
      </Panel>
    )
  }

  return (
    <Panel position="bottom-right" className="nodrag nopan">
      <Box
        sx={{
          width: 200,
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 2px 1px rgba(0,0,0,0.08)',
          bgcolor: '#1a1a1a',
          '& .canvas-minimap-embedded': {
            position: 'relative !important',
            inset: 'auto !important',
            margin: 0,
            width: '100%',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 0.75,
            py: 0.25,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#2b2b2b',
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 650,
              color: 'rgba(244,241,234,0.7)',
              letterSpacing: '0.02em',
            }}
          >
            Map
          </Typography>
          <Tooltip title="Hide map" arrow enterDelay={400}>
            <IconButton
              size="small"
              className="nodrag nopan"
              aria-label="Hide map"
              onClick={() => setOpenPersisted(false)}
              sx={{
                ...toggleButtonSx,
                width: 22,
                height: 22,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              <Box component="span" sx={{ fontSize: 14, lineHeight: 1 }}>
                −
              </Box>
            </IconButton>
          </Tooltip>
        </Box>
        <MiniMap
          className="canvas-minimap-embedded"
          pannable
          zoomable
          style={{ background: '#1a1a1a' }}
          maskColor="rgba(0,0,0,0.55)"
        />
      </Box>
    </Panel>
  )
}
