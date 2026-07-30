import { useCallback, useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { PipelineNodeView } from './PipelineNode'
import type { NodeMetadata } from '../../types'

export function PipelineCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)
  const addNodeFromType = useGraphStore((s) => s.addNodeFromType)

  const nodeTypes: NodeTypes = useMemo(() => ({ pipeline: PipelineNodeView }), [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/image-pipes-node')
      if (!raw) return
      const meta = JSON.parse(raw) as NodeMetadata
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      const position = {
        x: event.clientX - (bounds?.left ?? 0) - 80,
        y: event.clientY - (bounds?.top ?? 0) - 20,
      }
      addNodeFromType(meta, position)
    },
    [addNodeFromType],
  )

  return (
    <Box sx={{ width: '100%', height: '100%' }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background gap={16} />
      </ReactFlow>
    </Box>
  )
}
