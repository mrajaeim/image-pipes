import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'

/** Smooth-step edge with a mid-path remove control. */
export function RemovableEdge({
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
}: EdgeProps) {
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
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
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1,
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
      </EdgeLabelRenderer>
    </>
  )
}
