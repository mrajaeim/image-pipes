import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import type { NodeMetadata } from '../../types'
import { notifyError } from '../../notify'

async function fetchNodes(): Promise<NodeMetadata[]> {
  const response = await fetch('/api/nodes')
  if (!response.ok) throw new Error('Failed to load node catalog')
  return response.json()
}

const CATEGORY_ACCENT: Record<string, string> = {
  io: '#7dcea0',
  color: '#5dade2',
  filters: '#e67e22',
  geometry: '#af7ac5',
  stochastic: '#f5b041',
}

function categoryAccent(category: string): string {
  return CATEGORY_ACCENT[category.toLowerCase()] ?? '#95a5a6'
}

function portSummary(node: NodeMetadata): { inputs: number; outputs: number } {
  const inputs = node.ports.filter((port) => port.direction === 'input').length
  const outputs = node.ports.filter((port) => port.direction === 'output').length
  return { inputs, outputs }
}

function CategoryHeader({
  category,
  count,
  open,
  onToggle,
}: {
  category: string
  count: number
  open: boolean
  onToggle: () => void
}) {
  const accent = categoryAccent(category)
  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 0.75,
        py: 0.75,
        mb: 0.75,
        border: 'none',
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: 'transparent',
        color: 'inherit',
        textAlign: 'left',
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: accent,
          boxShadow: `0 0 0 3px ${accent}22`,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          flex: 1,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(244,241,234,0.72)',
        }}
      >
        {category}
      </Typography>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(244,241,234,0.4)',
          bgcolor: 'rgba(255,255,255,0.06)',
          px: 0.7,
          py: 0.15,
          borderRadius: 999,
          minWidth: 20,
          textAlign: 'center',
        }}
      >
        {count}
      </Typography>
      <Box
        component="span"
        sx={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 10,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 120ms ease',
        }}
      >
        ▾
      </Box>
    </Box>
  )
}

function NodeCard({
  node,
  onAdd,
}: {
  node: NodeMetadata
  onAdd: (node: NodeMetadata) => void
}) {
  const accent = categoryAccent(node.category)
  const { inputs, outputs } = portSummary(node)

  return (
    <Box
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/image-pipes-node', JSON.stringify(node))
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDoubleClick={() => onAdd(node)}
      title={`${node.description || node.type}\nDrag onto canvas · Double-click to add`}
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '4px 1fr',
        gap: 0,
        mb: 0.75,
        borderRadius: 1.25,
        overflow: 'hidden',
        cursor: 'grab',
        bgcolor: '#121212',
        border: '1px solid rgba(255,255,255,0.07)',
        transition:
          'border-color 120ms ease, background-color 120ms ease, transform 120ms ease',
        '&:hover': {
          bgcolor: '#181818',
          borderColor: `${accent}66`,
          transform: 'translateX(2px)',
        },
        '&:active': { cursor: 'grabbing', transform: 'translateX(0)' },
      }}
    >
      <Box sx={{ bgcolor: accent, opacity: 0.85 }} />
      <Box sx={{ px: 1.1, py: 0.9, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color: '#f4f1ea',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {node.label}
            </Typography>
            <Typography
              sx={{
                mt: 0.35,
                fontSize: 11,
                color: 'rgba(244,241,234,0.45)',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {node.description || node.type}
            </Typography>
          </Box>
          <IconButton
            size="small"
            className="nodrag"
            aria-label={`Add ${node.label}`}
            onClick={(event) => {
              event.stopPropagation()
              onAdd(node)
            }}
            sx={{
              width: 24,
              height: 24,
              color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 1,
              '&:hover': {
                color: accent,
                borderColor: `${accent}88`,
                bgcolor: `${accent}18`,
              },
            }}
          >
            <Box component="span" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
              +
            </Box>
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.85 }}>
          <Typography
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'rgba(125,206,160,0.9)',
              bgcolor: 'rgba(125,206,160,0.1)',
              px: 0.65,
              py: 0.15,
              borderRadius: 0.75,
            }}
          >
            {inputs} in
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'rgba(230,126,34,0.95)',
              bgcolor: 'rgba(230,126,34,0.12)',
              px: 0.65,
              py: 0.15,
              borderRadius: 0.75,
            }}
          >
            {outputs} out
          </Typography>
          {node.stochastic && (
            <Typography
              component="span"
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'rgba(245,176,65,0.95)',
                bgcolor: 'rgba(245,176,65,0.12)',
                px: 0.65,
                py: 0.15,
                borderRadius: 0.75,
              }}
            >
              random
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export function NodePalette() {
  const setNodeCatalog = useGraphStore((s) => s.setNodeCatalog)
  const catalog = useGraphStore((s) => s.nodeCatalog)
  const addNodeFromType = useGraphStore((s) => s.addNodeFromType)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { data, isLoading, error } = useQuery({ queryKey: ['nodes'], queryFn: fetchNodes })

  useEffect(() => {
    if (data) setNodeCatalog(data)
  }, [data, setNodeCatalog])

  useEffect(() => {
    if (error) notifyError('Could not load node catalog')
  }, [error])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return catalog
    return catalog.filter((node) => {
      const haystack = [node.label, node.type, node.category, node.description]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [catalog, query])

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, NodeMetadata[]>>((acc, node) => {
      acc[node.category] = acc[node.category] ?? []
      acc[node.category].push(node)
      return acc
    }, {})
  }, [filtered])

  const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

  const addNode = (node: NodeMetadata) => {
    const offset = (useGraphStore.getState().nodes.length % 8) * 28
    addNodeFromType(node, { x: 180 + offset, y: 120 + offset })
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: '#141414',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          pt: 1.5,
          pb: 1.25,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: '#141414',
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 700,
            fontSize: 18,
            color: '#f4f1ea',
            lineHeight: 1.2,
          }}
        >
          Nodes
        </Typography>
        <Typography
          sx={{
            mt: 0.35,
            mb: 1.25,
            fontSize: 11,
            color: 'rgba(244,241,234,0.45)',
            lineHeight: 1.35,
          }}
        >
          Drag onto the canvas, or press + / double-click to drop
        </Typography>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search nodes…"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>⌕</Typography>
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    sx={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    <Typography component="span" sx={{ fontSize: 12, lineHeight: 1 }}>
                      ×
                    </Typography>
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
          sx={{
            '& .MuiInputBase-root': {
              color: '#eee',
              bgcolor: '#0f0f0f',
              borderRadius: 1.25,
              fontSize: 13,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.1)',
            },
            '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.18)',
            },
            '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(125,206,160,0.55)',
            },
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 1.25, py: 1.25 }}>
        {isLoading && (
          <Typography sx={{ px: 0.5, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            Loading node catalog…
          </Typography>
        )}
        {error && (
          <Typography sx={{ px: 0.5, fontSize: 12, color: '#ff8a80' }}>
            Could not load nodes
          </Typography>
        )}
        {!isLoading && !error && categories.length === 0 && (
          <Box
            sx={{
              px: 1,
              py: 3,
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 1.5,
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(244,241,234,0.7)' }}>
              No matches
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 11, color: 'rgba(244,241,234,0.4)' }}>
              Try another search term
            </Typography>
          </Box>
        )}

        {categories.map((category) => {
          const nodes = grouped[category]
          const open = !collapsed[category]
          return (
            <Box key={category} sx={{ mb: 1.25 }}>
              <CategoryHeader
                category={category}
                count={nodes.length}
                open={open}
                onToggle={() =>
                  setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }))
                }
              />
              <Collapse in={open} timeout={140} unmountOnExit>
                {nodes.map((node) => (
                  <NodeCard key={node.type} node={node} onAdd={addNode} />
                ))}
              </Collapse>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
