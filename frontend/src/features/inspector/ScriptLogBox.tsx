import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'

type ScriptLogBoxProps = {
  nodeId: string
}

const EMPTY_LINES: string[] = []

export function ScriptLogBox({ nodeId }: ScriptLogBoxProps) {
  const lines = useGraphStore((s) => s.scriptLogsByNodeId[nodeId] ?? EMPTY_LINES)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 650, color: 'rgba(244,241,234,0.7)' }}>
        Script log
      </Typography>
      <Box
        ref={listRef}
        sx={{
          height: 140,
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 1,
          bgcolor: '#0c0c0c',
          px: 1.25,
          py: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 11,
          lineHeight: 1.45,
          color: 'rgba(244,241,234,0.72)',
        }}
      >
        {lines.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(244,241,234,0.4)', fontFamily: 'inherit' }}>
            No script logs yet — call <code>log(...)</code> in process().
          </Typography>
        ) : (
          lines.map((line, index) => (
            <Box
              key={`${index}-${line.slice(0, 24)}`}
              component="div"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {line}
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}
