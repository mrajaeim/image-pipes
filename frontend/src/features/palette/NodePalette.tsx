import { useQuery } from '@tanstack/react-query'
import { Box, Chip, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useEffect } from 'react'
import { useGraphStore } from '../../store/graphStore'
import type { NodeMetadata } from '../../types'

async function fetchNodes(): Promise<NodeMetadata[]> {
  const response = await fetch('/api/nodes')
  if (!response.ok) throw new Error('Failed to load node catalog')
  return response.json()
}

export function NodePalette() {
  const setNodeCatalog = useGraphStore((s) => s.setNodeCatalog)
  const catalog = useGraphStore((s) => s.nodeCatalog)
  const { data, isLoading, error } = useQuery({ queryKey: ['nodes'], queryFn: fetchNodes })

  useEffect(() => {
    if (data) setNodeCatalog(data)
  }, [data, setNodeCatalog])

  const grouped = catalog.reduce<Record<string, NodeMetadata[]>>((acc, node) => {
    acc[node.category] = acc[node.category] ?? []
    acc[node.category].push(node)
    return acc
  }, {})

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Nodes
      </Typography>
      {isLoading && <Typography variant="body2">Loading…</Typography>}
      {error && (
        <Typography variant="body2" color="error">
          Could not load nodes
        </Typography>
      )}
      {Object.entries(grouped).map(([category, nodes]) => (
        <Box key={category} sx={{ mb: 2 }}>
          <Chip label={category} size="small" sx={{ mb: 1 }} />
          <List dense disablePadding>
            {nodes.map((node) => (
              <ListItemButton
                key={node.type}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    'application/image-pipes-node',
                    JSON.stringify(node),
                  )
                  event.dataTransfer.effectAllowed = 'move'
                }}
                sx={{ borderRadius: 1, mb: 0.5, bgcolor: 'background.default' }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {node.label}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" component="span">
                      {node.description || node.type}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  )
}
