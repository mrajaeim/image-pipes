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
  Stack,
  Typography,
} from '@mui/material'
import type { GraphNodeData, PortSpec } from '../../types'
import { useGraphStore, type NodeImageState } from '../../store/graphStore'
import { useNodeMenu } from './NodeMenu'
import { isImageLikePort, portTypeColor } from '../../lib/portTypes'

type PipelineFlowNode = Node<GraphNodeData, 'pipeline'>

type ImageItem = {
  src: string
  portId?: string
  sampleIndex?: number
  label?: string
}

const CELL_WIDTH = 150
const IMAGE_HEIGHT = 140
const HEADER_HEIGHT = 44
const MAX_VISIBLE_ROWS = 8

const handleBaseStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid #111',
  zIndex: 1003,
  pointerEvents: 'all',
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

function sideHandleTop(index: number, total: number, contentHeight: number): number {
  if (total <= 1) return HEADER_HEIGHT + contentHeight / 2
  const slot = contentHeight / total
  return HEADER_HEIGHT + slot * index + slot / 2
}

function PortTag({
  label,
  top,
  side,
}: {
  label: string
  top: number
  side: 'left' | 'right'
}) {
  return (
    <Typography
      component="span"
      sx={{
        position: 'absolute',
        top,
        ...(side === 'right'
          ? { left: '100%', ml: 1.25, transform: 'translateY(-50%)' }
          : { right: '100%', mr: 1.25, transform: 'translateY(-50%)' }),
        px: 0.7,
        py: 0.15,
        borderRadius: 0.75,
        bgcolor: 'rgba(0,0,0,0.78)',
        color: '#f0f0f0',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 1004,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {label}
    </Typography>
  )
}

function imagesForPort(entry: NodeImageState, portId: string): string[] {
  const stacked = entry.portSamples[portId]
  if (stacked && stacked.some(Boolean)) return stacked
  const latest = entry.ports[portId]
  if (latest) return [latest]
  if (portId === 'image') {
    if (entry.samples.some(Boolean)) return entry.samples
    if (entry.result) return [entry.result]
  }
  return []
}

function buildRowsFromColumns(
  columns: string[],
  columnImages: string[][],
  sectionPorts: PortSpec[],
): ImageItem[][] {
  const totalRows = Math.max(1, ...columnImages.map((images) => images.length))
  const hasAny = columnImages.some((images) => images.some(Boolean))
  if (!hasAny) return []

  const visibleRows = Math.min(totalRows, MAX_VISIBLE_ROWS)
  const rows: ImageItem[][] = []
  for (let row = 0; row < visibleRows; row += 1) {
    rows.push(
      columns.map((portId, col) => {
        const src = columnImages[col][row] ?? ''
        const overflow =
          totalRows > visibleRows && row === visibleRows - 1
            ? `+${totalRows - visibleRows + 1} more`
            : undefined
        const channel = portLabel(portId, sectionPorts)
        const sampleTag = totalRows > 1 ? `In ${row + 1}` : undefined
        const parts = [sampleTag, channel].filter(Boolean)
        return {
          src,
          portId,
          sampleIndex: row,
          label: overflow ?? (parts.length > 0 ? parts.join(' · ') : undefined),
        }
      }),
    )
  }
  return rows
}

function buildPreviewGrid({
  entry,
  outputPorts,
  localPreviewUrls,
}: {
  entry: NodeImageState | undefined
  outputPorts: PortSpec[]
  localPreviewUrls: string[]
}): { columns: string[]; rows: ImageItem[][]; sectionPorts: PortSpec[] } {
  // Prefer image-like output ports for the preview grid; annotation ports are
  // overlaid on the image by the backend and shown as caption chips.
  const imagePorts = outputPorts.filter((port) => isImageLikePort(port.data_type))
  const multiOut = imagePorts.length > 1
  const sectionPorts = multiOut
    ? imagePorts
    : imagePorts.length > 0
      ? imagePorts
      : outputPorts.length > 0 && isImageLikePort(outputPorts[0].data_type)
        ? [outputPorts[0]]
        : [
            {
              id: 'image',
              name: 'Image',
              direction: 'output' as const,
              data_type: 'image',
              multiple: false,
            },
          ]
  const columns = multiOut
    ? sectionPorts.map((port) => port.id)
    : [sectionPorts[0]?.id ?? 'image']

  if (entry) {
    const columnImages = columns.map((portId) => imagesForPort(entry, portId))
    const rows = buildRowsFromColumns(columns, columnImages, sectionPorts)
    if (rows.length > 0) return { columns, rows, sectionPorts }
  }

  if (localPreviewUrls.length > 0) {
    const visible = localPreviewUrls.slice(0, MAX_VISIBLE_ROWS)
    const rows = visible.map((src, index) => [
      {
        src,
        portId: columns[0],
        sampleIndex: index,
        label:
          localPreviewUrls.length > visible.length && index === visible.length - 1
            ? `+${localPreviewUrls.length - visible.length + 1} more`
            : localPreviewUrls.length > 1
              ? `In ${index + 1}`
              : undefined,
      },
    ])
    return { columns: [columns[0]], rows, sectionPorts }
  }

  return { columns, rows: [], sectionPorts }
}

export function PipelineNodeView({ id, data, selected }: NodeProps<PipelineFlowNode>) {
  const [viewer, setViewer] = useState<ImageItem | null>(null)
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeImages = useGraphStore((state) => state.nodeImages)
  const catalog = useGraphStore((state) => state.nodeCatalog)
  const timing = useGraphStore((state) => state.nodeTimings[id])
  const localPreviewUrls = useGraphStore(
    (state) => state.nodes.find((node) => node.id === id)?.data.localPreviewUrls ?? [],
  )
  const { menu: nodeMenu, openFromContext } = useNodeMenu({
    nodeId: id,
    label: data.label,
    category: data.category,
  })

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

  const grid = useMemo(
    () =>
      buildPreviewGrid({
        entry: nodeImages[id],
        outputPorts,
        localPreviewUrls,
      }),
    [id, localPreviewUrls, nodeImages, outputPorts],
  )

  const sectionPorts = grid.sectionPorts
  const columnCount = Math.max(1, grid.columns.length)
  const rowCount = Math.max(1, grid.rows.length)
  // Keep enough height for stacked multi-input/output port handles without fake body sections.
  const portCount = Math.max(inputPorts.length, outputPorts.length, 1)
  const contentHeight = Math.max(rowCount * IMAGE_HEIGHT, portCount > 1 ? portCount * 52 : IMAGE_HEIGHT)
  const nodeWidth = columnCount * CELL_WIDTH

  useEffect(() => {
    updateNodeInternals(id)
  }, [
    id,
    columnCount,
    rowCount,
    contentHeight,
    nodeWidth,
    inputPorts.length,
    outputPorts.length,
    updateNodeInternals,
  ])

  const emptyHint =
    data.type === 'load_image' || inputPorts.length === 0
      ? 'Choose images or a folder'
      : data.type === 'annotations'
        ? 'Edit bboxes & keypoints in the inspector'
        : 'Connect upstream, then Run'

  const annotationSummary = useMemo(() => {
    const annotations = nodeImages[id]?.annotations
    if (!annotations) return null
    const boxCount = Array.isArray(annotations.bboxes) ? annotations.bboxes.length : 0
    const kpCount = Array.isArray(annotations.keypoints) ? annotations.keypoints.length : 0
    if (boxCount === 0 && kpCount === 0) return null
    const parts: string[] = []
    if (boxCount > 0) parts.push(`${boxCount} bbox${boxCount === 1 ? '' : 's'}`)
    if (kpCount > 0) parts.push(`${kpCount} kp`)
    return parts.join(' · ')
  }, [id, nodeImages])

  return (
    <>
      <Box
        onContextMenu={openFromContext}
        sx={{
          position: 'relative',
          width: nodeWidth,
          borderRadius: 1.5,
          border: '2px solid',
          borderColor: data.active ? '#e67e22' : selected ? '#7dcea0' : '#2c2c2c',
          bgcolor: '#111',
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
            overflow: 'hidden',
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 0%', overflow: 'hidden', pr: 0.25 }}>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
          <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>{nodeMenu}</Box>
        </Stack>

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          {timing && (
            <Box
              component="span"
              title={timing.cacheHit ? 'Served from cache' : 'Execution time'}
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 2,
                px: 0.7,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: timing.cacheHit
                  ? 'rgba(20,40,30,0.85)'
                  : 'rgba(0,0,0,0.72)',
                border: '1px solid',
                borderColor: timing.cacheHit
                  ? 'rgba(125,206,160,0.45)'
                  : 'rgba(255,255,255,0.18)',
                color: timing.cacheHit ? '#7dcea0' : 'rgba(255,255,255,0.85)',
                fontSize: 10,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                pointerEvents: 'none',
              }}
            >
              {timing.ms < 10 ? timing.ms.toFixed(1) : Math.round(timing.ms)}
              ms
              {timing.cacheHit ? ' · cache' : ''}
            </Box>
          )}
          {annotationSummary && (
            <Box
              component="span"
              title="Annotation targets from last run"
              sx={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                zIndex: 2,
                px: 0.7,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: 'rgba(0,0,0,0.72)',
                border: '1px solid rgba(245,176,65,0.45)',
                color: '#f5b041',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {annotationSummary}
            </Box>
          )}
          {grid.rows.length === 0
            ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columnCount}, ${CELL_WIDTH}px)`,
                    height: contentHeight,
                  }}
                >
                  {Array.from({ length: columnCount }).map((__, col) => (
                    <Box
                      key={`empty-0-${col}`}
                      sx={{
                        position: 'relative',
                        height: contentHeight,
                        borderLeft: col === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: '#141414',
                        backgroundImage:
                          'repeating-linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 10px, transparent 10px, transparent 20px)',
                      }}
                    >
                      {col === Math.floor((columnCount - 1) / 2) && (
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: 12,
                            textAlign: 'center',
                            px: 1.5,
                            lineHeight: 1.4,
                          }}
                        >
                          {emptyHint}
                        </Typography>
                      )}
                      {columnCount > 1 && sectionPorts[col] && (
                        <Typography
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            px: 0.7,
                            py: 0.15,
                            borderRadius: 0.75,
                            bgcolor: 'rgba(0,0,0,0.55)',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {sectionPorts[col].name}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )
            : grid.rows.map((rowItems, row) => (
                <Box
                  key={`row-${row}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columnCount}, ${CELL_WIDTH}px)`,
                    height: IMAGE_HEIGHT,
                    borderTop: row === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {rowItems.map((item, col) => (
                    <Box
                      key={`${item.portId ?? 'img'}-${row}-${col}`}
                      className="nodrag nopan"
                      onClick={(event) => {
                        if (!item.src) return
                        event.stopPropagation()
                        setViewer(item)
                      }}
                      sx={{
                        position: 'relative',
                        height: IMAGE_HEIGHT,
                        borderLeft: col === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        ...checkerboard,
                        cursor: item.src ? 'zoom-in' : 'default',
                      }}
                    >
                      {item.src ? (
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
                      ) : null}
                      {(item.label || (row === 0 && columnCount > 1)) && (
                        <Typography
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            px: 0.7,
                            py: 0.15,
                            borderRadius: 0.75,
                            bgcolor: 'rgba(0,0,0,0.72)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            pointerEvents: 'none',
                          }}
                        >
                          {item.label ??
                            portLabel(item.portId, sectionPorts) ??
                            `Out ${col + 1}`}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ))}
        </Box>

        {inputPorts.map((port, index) => {
          const top = sideHandleTop(index, Math.max(inputPorts.length, 1), contentHeight)
          const showLabel =
            inputPorts.length > 1 || port.id !== 'image' || Boolean(port.optional)
          return (
            <Box key={`in-${port.id}`}>
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{
                  ...handleBaseStyle,
                  top,
                  left: -7,
                  background: portTypeColor(port.data_type, '#7dcea0'),
                }}
              />
              {showLabel && (
                <PortTag
                  label={port.optional ? `${port.name} (optional)` : port.name}
                  top={top}
                  side="left"
                />
              )}
            </Box>
          )
        })}
        {outputPorts.map((port, index) => {
          const top = sideHandleTop(index, Math.max(outputPorts.length, 1), contentHeight)
          const showLabel = outputPorts.length > 1 || port.id !== 'image'
          return (
            <Box key={`out-${port.id}`}>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{
                  ...handleBaseStyle,
                  top,
                  right: -7,
                  left: 'auto',
                  background: portTypeColor(port.data_type, '#e67e22'),
                }}
              />
              {showLabel && (
                <PortTag
                  label={port.optional ? `${port.name} (optional)` : port.name}
                  top={top}
                  side="right"
                />
              )}
            </Box>
          )
        })}
        {outputPorts.length === 0 && (
          <Handle
            type="source"
            position={Position.Right}
            id="image"
            style={{
              ...handleBaseStyle,
              top: sideHandleTop(0, 1, contentHeight),
              right: -7,
              left: 'auto',
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
            {viewer?.src && (
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
