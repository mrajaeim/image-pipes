import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'

export function ExecutionLogPanel() {
  const logs = useGraphStore((s) => s.logs)
  const nodeTimings = useGraphStore((s) => s.nodeTimings)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const activeNodeId = useGraphStore((s) => s.activeNodeId)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs])

  const timingEntries = Object.entries(nodeTimings)
  const totalMs = timingEntries.reduce((sum, [, timing]) => sum + timing.ms, 0)

  return (
    <Box
      sx={{
        height: 120,
        minHeight: 120,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: '#101010',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 1.25,
          px: 1.5,
          pt: 1,
          pb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 700,
            fontSize: 13,
            color: '#f4f1ea',
          }}
        >
          Execution Log
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'rgba(244,241,234,0.4)' }}>
          {isExecuting
            ? activeNodeId
              ? `Running ${activeNodeId}…`
              : 'Running…'
            : timingEntries.length > 0
              ? `${timingEntries.length} nodes · ${totalMs.toFixed(1)}ms`
              : 'Idle'}
        </Typography>
      </Box>
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.5,
          pb: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 11,
          lineHeight: 1.55,
          color: 'rgba(244,241,234,0.65)',
        }}
      >
        {logs.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(244,241,234,0.35)' }}>
            Run a pipeline to see per-node timing and progress.
          </Typography>
        ) : (
          logs.map((line, index) => (
            <Box key={`${index}-${line}`} component="div">
              {line}
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}
