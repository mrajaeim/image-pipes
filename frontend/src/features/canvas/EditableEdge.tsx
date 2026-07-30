import { useCallback, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { useGraphStore } from '../../store/graphStore'

export type EdgeWaypoint = { x: number; y: number }

export type EditableEdgeData = {
  waypoints?: EdgeWaypoint[]
}

type Point = { x: number; y: number }

function inferPositions(from: Point, to: Point): { source: Position; target: Position } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      source: dx >= 0 ? Position.Right : Position.Left,
      target: dx >= 0 ? Position.Left : Position.Right,
    }
  }
  return {
    source: dy >= 0 ? Position.Bottom : Position.Top,
    target: dy >= 0 ? Position.Top : Position.Bottom,
  }
}

function buildRoutedPath(
  points: Point[],
  sourcePosition: Position,
  targetPosition: Position,
): { path: string; labelX: number; labelY: number } {
  if (points.length < 2) {
    return { path: '', labelX: 0, labelY: 0 }
  }

  const segments: string[] = []
  let labelX = 0
  let labelY = 0
  let labelWeight = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const inferred = inferPositions(from, to)
    const [segment, midX, midY] = getSmoothStepPath({
      sourceX: from.x,
      sourceY: from.y,
      targetX: to.x,
      targetY: to.y,
      sourcePosition: index === 0 ? sourcePosition : inferred.source,
      targetPosition: index === points.length - 2 ? targetPosition : inferred.target,
      borderRadius: 10,
    })
    if (index === 0) {
      segments.push(segment)
    } else {
      segments.push(segment.replace(/^M[^a-zA-Z]+/, ''))
    }
    const weight = index === Math.floor((points.length - 2) / 2) ? 2 : 1
    labelX += midX * weight
    labelY += midY * weight
    labelWeight += weight
  }

  return {
    path: segments.join(' '),
    labelX: labelX / Math.max(1, labelWeight),
    labelY: labelY / Math.max(1, labelWeight),
  }
}

function insertWaypoint(waypoints: EdgeWaypoint[], point: Point, anchors: Point[]): EdgeWaypoint[] {
  if (anchors.length < 2) return [...waypoints, point]

  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const a = anchors[index]
    const b = anchors[index + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
    const projX = a.x + dx * t
    const projY = a.y + dy * t
    const dist = (point.x - projX) ** 2 + (point.y - projY) ** 2
    if (dist < bestDistance) {
      bestDistance = dist
      bestIndex = index
    }
  }
  const next = [...waypoints]
  next.splice(bestIndex, 0, point)
  return next
}

function BendHandle({
  x,
  y,
  selected,
  label,
  title,
  onDrag,
  onRemove,
}: {
  x: number
  y: number
  selected?: boolean
  label: string
  title: string
  onDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onRemove?: () => void
}) {
  return (
    <button
      type="button"
      className="nodrag nopan"
      aria-label={label}
      title={title}
      onPointerDown={onDrag}
      onDoubleClick={(event) => {
        if (!onRemove) return
        event.stopPropagation()
        event.preventDefault()
        onRemove()
      }}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: 'all',
        zIndex: 3,
        width: 16,
        height: 16,
        borderRadius: 4,
        border: '2px solid #0c0c0c',
        background: selected ? '#e67e22' : 'rgba(255,255,255,0.9)',
        cursor: 'grab',
        padding: 0,
        boxShadow: '0 1px 6px rgba(0,0,0,0.45)',
      }}
    />
  )
}

/** Smooth-step edge: drag ends to reconnect, drag bends to reshape, × to remove. */
export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<Edge<EditableEdgeData>>) {
  const { deleteElements, screenToFlowPosition } = useReactFlow()
  const setEdgeWaypoints = useGraphStore((state) => state.setEdgeWaypoints)
  const waypoints = useMemo(() => data?.waypoints ?? [], [data?.waypoints])

  const points = useMemo(
    () => [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }],
    [sourceX, sourceY, targetX, targetY, waypoints],
  )

  const { path, labelX, labelY } = useMemo(
    () => buildRoutedPath(points, sourcePosition, targetPosition),
    [points, sourcePosition, targetPosition],
  )

  const startDragExisting = useCallback(
    (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)

      const onMove = (moveEvent: PointerEvent) => {
        const point = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        const current =
          (useGraphStore.getState().edges.find((edge) => edge.id === id)?.data as
            | EditableEdgeData
            | undefined)?.waypoints ?? []
        setEdgeWaypoints(
          id,
          current.map((item, i) => (i === index ? point : item)),
        )
      }
      const onUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [id, screenToFlowPosition, setEdgeWaypoints],
  )

  const startDragNewBend = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)

      const onMove = (moveEvent: PointerEvent) => {
        const point = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        const current =
          (useGraphStore.getState().edges.find((edge) => edge.id === id)?.data as
            | EditableEdgeData
            | undefined)?.waypoints ?? []
        if (current.length === 0) {
          setEdgeWaypoints(id, [point])
          return
        }
        // Keep updating the first inserted bend while dragging from the midpoint grip.
        setEdgeWaypoints(id, [point, ...current.slice(1)])
      }
      const onUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [id, screenToFlowPosition, setEdgeWaypoints],
  )

  const onEdgeClick = useCallback(
    (event: React.MouseEvent) => {
      // Alt/Option-click inserts a bend at the cursor.
      if (!event.altKey) return
      event.stopPropagation()
      event.preventDefault()
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const current =
        (useGraphStore.getState().edges.find((edge) => edge.id === id)?.data as
          | EditableEdgeData
          | undefined)?.waypoints ?? []
      const anchors = [
        { x: sourceX, y: sourceY },
        ...current,
        { x: targetX, y: targetY },
      ]
      setEdgeWaypoints(id, insertWaypoint(current, point, anchors))
    },
    [id, screenToFlowPosition, setEdgeWaypoints, sourceX, sourceY, targetX, targetY],
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        interactionWidth={28}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        className="react-flow__edge-interaction"
        onClick={onEdgeClick}
        style={{ cursor: 'pointer' }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan"
          aria-label="Remove connection"
          onClick={(event) => {
            event.stopPropagation()
            void deleteElements({ edges: [{ id }] })
          }}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 18}px)`,
            pointerEvents: 'all',
            zIndex: 2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: selected
              ? '1px solid rgba(230,126,34,0.9)'
              : '1px solid rgba(255,255,255,0.28)',
            background: selected ? '#c0392b' : 'rgba(28,28,28,0.95)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
          }}
        >
          ×
        </button>

        {/* Midpoint grip: drag to create/move the first bend (always available). */}
        {waypoints.length === 0 && (
          <BendHandle
            x={labelX}
            y={labelY}
            selected={selected}
            label="Bend connection"
            title="Drag to reshape the connector"
            onDrag={startDragNewBend}
          />
        )}

        {waypoints.map((point, index) => (
          <BendHandle
            key={`wp-${index}`}
            x={point.x}
            y={point.y}
            selected={selected}
            label={`Move bend ${index + 1}`}
            title="Drag to reshape · double-click to remove"
            onDrag={(event) => startDragExisting(index, event)}
            onRemove={() =>
              setEdgeWaypoints(
                id,
                waypoints.filter((_, i) => i !== index),
              )
            }
          />
        ))}
      </EdgeLabelRenderer>
    </>
  )
}
