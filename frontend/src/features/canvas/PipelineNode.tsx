import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Box, Typography } from '@mui/material'
import type { GraphNodeData } from '../../types'

export function PipelineNodeView({ data, selected }: NodeProps) {
  const nodeData = data as GraphNodeData
  return (
    <Box
      sx={{
        minWidth: 160,
        borderRadius: 1.5,
        border: '2px solid',
        borderColor: nodeData.active ? 'secondary.main' : selected ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: nodeData.active ? 4 : 1,
        px: 1.5,
        py: 1,
      }}
    >
      <Handle type="target" position={Position.Left} id="image" style={{ background: '#1b4d3e' }} />
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
        {nodeData.category}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {nodeData.label}
      </Typography>
      <Handle type="source" position={Position.Right} id="image" style={{ background: '#c45c26' }} />
    </Box>
  )
}
