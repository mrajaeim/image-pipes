import { useEffect, useMemo, useState } from 'react'
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material'
import type { GraphNodeData, PortSpec } from '../../types'
import { useGraphStore } from '../../store/graphStore'

type PipelineFlowNode = Node<GraphNodeData, 'pipeline'>

type ImageItem = {
  src: string
  portId?: string
  label?: string
}

const IMAGE_HEIGHT = 160
const HEADER_HEIGHT = 44

const handleBaseStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid #111',
  zIndex: 30,
}

const checkerboard = {
  backgroundColor: '#1a1a1a',
  backgroundImage:
    'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
}

function toSrc(image: string): string {
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`
}

function portLabel(portId: string | undefined, ports: PortSpec[]): string | undefined {
  if (!portId || portId === 'image') return undefined
  return ports.find((port) => port.id === portId)?.name ?? portId.toUpperCase()
}

function handleTop(index: number, total: number, contentHeight: number): number {
  if (total <= 1) return HEADER_HEIGHT + contentHeight / 2
  const row = contentHeight / total
  return HEADER_HEIGHT + row * index + row / 2
}

function NodeActions({ nodeId }: { nodeId: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const removeNode = useGraphStore((state) => state.removeNode)
  const duplicateNode = useGraphStore((state) => state.duplicateNode)
  const selectNode = useGraphStore((state) => state.selectNode)

  return (
    <>
      <IconButton
        size="small"
        className="nodrag nopan"
        aria-label="Node actions"
        onClick={(event) => {
          event.stopPropagation()
          selectNode(nodeId)
          setAnchor(event.currentTarget)
        }}
        sx={{ width: 26, height: 26, color: 'rgba(255,255,255,0.75)' }}
      >
        <Box component="span" sx={{ fontSize: 16, lineHeight: 1, fontWeight: 700 }}>
          ⋮
        </Box>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          className="nodrag nopan"
          onClick={() => {
            duplicateNode(nodeId)
            setAnchor(null)
          }}
        >
          <ListItemIcon>
            <Box component="span" sx={{ fontSize: 14 }}>
              ⎘
            </Box>
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          className="nodrag nopan"
          onClick={() => {
            removeNode(nodeId)
            setAnchor(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Box component="span" sx={{ fontSize: 14, color: 'error.main' }}>
              ⌫
            </Box>
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}

export function PipelineNodeView({ id, data, selected }: NodeProps<PipelineFlowNode>) {
  const [viewer, setViewer] = useState<ImageItem | null>(null)
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeImages = useGraphStore((state) => state.nodeImages)
  const catalog = useGraphStore((state) => state.nodeCatalog)
  const localPreviewUrls = useGraphStore(
    (state) => state.nodes.find((node) => node.id === id)?.data.localPreviewUrls ?? [],
  )

  const ports = useMemo(() => {
    if (data.ports?.length) return data.ports
    return catalog.find((item) => item.type === data.type)?.ports ?? []
  }, [catalog, data.ports, data.type])

  const inputPorts = useMemo(
    () => ports.filter((port) => port.direction === 'input'),
    [ports],
  )
  const outputPorts = useMemo(
    () => ports.filter((port) => port.direction === 'output'),
    [ports],
  )

  const images = useMemo(() => {
    const entry = nodeImages[id]
    if (entry) {
      const samples = entry.samples.filter(Boolean)
      // Batch load / stochastic samples: show the full array first.
      if (samples.length > 1) {
        const visible = samples.slice(0, 8)
        return visible.map((src, index) => ({
          src,
          portId: outputPorts[0]?.id ?? 'image',
          label:
            samples.length > visible.length && index === visible.length - 1
              ? `+${samples.length - visible.length + 1} more`
              : `Image ${index + 1}`,
        }))
      }

      const ordered: ImageItem[] = []
      if (outputPorts.length > 0) {
        for (const port of outputPorts) {
          const src = entry.ports[port.id]
          if (!src) continue
          ordered.push({
            src,
            portId: port.id,
            label: portLabel(port.id, outputPorts),
          })
        }
      } else {
        for (const [portId, src] of Object.entries(entry.ports)) {
          ordered.push({
            src,
            portId,
            label: portLabel(portId, outputPorts),
          })
        }
      }
      if (ordered.length > 0) return ordered

      if (samples.length === 1) {
        return [{ src: samples[0], portId: outputPorts[0]?.id ?? 'image' }]
      }
      if (entry.result) {
        return [{ src: entry.result, portId: outputPorts[0]?.id ?? 'image' }]
      }
    }

    if (localPreviewUrls.length > 0) {
      const visible = localPreviewUrls.slice(0, 8)
      const items = visible.map((src, index) => ({
        src,
        portId: outputPorts[0]?.id ?? 'image',
        label: localPreviewUrls.length > 1 ? `Image ${index + 1}` : undefined,
      }))
      if (localPreviewUrls.length > visible.length) {
        items[items.length - 1] = {
          ...items[items.length - 1],
          label: `+${localPreviewUrls.length - visible.length + 1} more`,
        }
      }
      return items
    }
    return []
  }, [id, localPreviewUrls, nodeImages, outputPorts])

  const rowCount = Math.max(
    1,
    images.length,
    outputPorts.length || 0,
    inputPorts.length > 1 ? inputPorts.length : 1,
  )
  const contentHeight = rowCount * IMAGE_HEIGHT

  // Keep handle geometry in sync when images appear/disappear after a run.
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, images.length, contentHeight, inputPorts.length, outputPorts.length, updateNodeInternals])

  const emptyHint =
    data.type === 'load_image' || inputPorts.length === 0
      ? 'Choose images or a folder'
      : 'Connect upstream, then Run'

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          width: 220,
          borderRadius: 1.5,
          border: '2px solid',
          borderColor: data.active ? '#e67e22' : selected ? '#7dcea0' : '#2c2c2c',
          bgcolor: '#111',
          // Do not clip handles — they must stay clickable after run.
          overflow: 'visible',
          boxShadow: data.active
            ? '0 0 0 3px rgba(230,126,34,0.28), 0 16px 32px rgba(0,0,0,0.35)'
            : selected
              ? '0 0 0 3px rgba(125,206,160,0.25), 0 14px 28px rgba(0,0,0,0.3)'
              : '0 12px 24px rgba(0,0,0,0.28)',
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            height: HEADER_HEIGHT,
            px: 1,
            alignItems: 'center',
            bgcolor: '#1b1b1b',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              {data.category}
            </Typography>
            <Typography
              sx={{
                color: '#f5f5f5',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {data.label}
            </Typography>
          </Box>
          <NodeActions nodeId={id} />
        </Stack>

        <Box
          sx={{
            overflow: 'hidden',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          {images.length === 0
            ? Array.from({ length: rowCount }).map((_, index) => (
                <Box
                  key={`empty-${index}`}
                  sx={{
                    height: IMAGE_HEIGHT,
                    borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: '#141414',
                    backgroundImage:
                      'repeating-linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 10px, transparent 10px, transparent 20px)',
                  }}
                >
                  {index === 0 && (
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 12,
                        textAlign: 'center',
                        px: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {emptyHint}
                    </Typography>
                  )}
                </Box>
              ))
            : images.map((item, index) => (
                <Box
                  key={`${item.portId ?? 'img'}-${index}`}
                  className="nodrag nopan"
                  onClick={(event) => {
                    event.stopPropagation()
                    setViewer(item)
                  }}
                  sx={{
                    position: 'relative',
                    height: IMAGE_HEIGHT,
                    borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    ...checkerboard,
                    cursor: 'zoom-in',
                  }}
                >
                  <Box
                    component="img"
                    src={toSrc(item.src)}
                    alt={item.label ?? 'node image'}
                    draggable={false}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                  {item.label && (
                    <Typography
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        px: 0.9,
                        py: 0.2,
                        borderRadius: 0.75,
                        bgcolor: 'rgba(0,0,0,0.72)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        pointerEvents: 'none',
                      }}
                    >
                      {item.label}
                    </Typography>
                  )}
                </Box>
              ))}
        </Box>

        {/* Stable handles (not remounted when images appear after Run) */}
        {inputPorts.map((port, index) => (
          <Handle
            key={`in-${port.id}`}
            type="target"
            position={Position.Left}
            id={port.id}
            style={{
              ...handleBaseStyle,
              top: handleTop(index, Math.max(inputPorts.length, 1), contentHeight),
              background: '#7dcea0',
            }}
          />
        ))}
        {outputPorts.map((port, index) => (
          <Handle
            key={`out-${port.id}`}
            type="source"
            position={Position.Right}
            id={port.id}
            style={{
              ...handleBaseStyle,
              top: handleTop(
                index,
                Math.max(outputPorts.length, images.length || 1),
                contentHeight,
              ),
              background: '#e67e22',
            }}
          />
        ))}
        {outputPorts.length === 0 && (
          <Handle
            type="source"
            position={Position.Right}
            id="image"
            style={{
              ...handleBaseStyle,
              top: handleTop(0, 1, contentHeight),
              background: '#e67e22',
            }}
          />
        )}
      </Box>

      <Dialog
        open={Boolean(viewer)}
        onClose={() => setViewer(null)}
        maxWidth="md"
        fullWidth
        className="nodrag nopan"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle sx={{ fontFamily: '"Fraunces", Georgia, serif' }}>
          {data.label}
          {viewer?.label ? ` · ${viewer.label}` : ''}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              ...checkerboard,
              borderRadius: 2,
              minHeight: 360,
              display: 'grid',
              placeItems: 'center',
              p: 2,
            }}
          >
            {viewer && (
              <Box
                component="img"
                src={toSrc(viewer.src)}
                alt={viewer.label ?? data.label}
                sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}
