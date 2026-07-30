import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { PipelineNodeView } from './PipelineNode'
import { EditableEdge } from './EditableEdge'
import type { NodeMetadata } from '../../types'

function FitViewOnGraphChange() {
  const { fitView } = useReactFlow()
  const graphRevision = useGraphStore((s) => s.graphRevision)
  const nodeCount = useGraphStore((s) => s.nodes.length)

  useEffect(() => {
    if (graphRevision === 0 || nodeCount === 0) return
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.2, duration: 220 })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [fitView, graphRevision, nodeCount])

  return null
}

export function PipelineCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)
  const addNodeFromType = useGraphStore((s) => s.addNodeFromType)
  const duplicateNode = useGraphStore((s) => s.duplicateNode)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  const nodeTypes: NodeTypes = useMemo(() => ({ pipeline: PipelineNodeView }), [])
  const edgeTypes: EdgeTypes = useMemo(() => ({ editable: EditableEdge }), [])

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

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.source || !connection.target) return false
    return connection.source !== connection.target
  }, [])

  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      useGraphStore.setState((state) => ({
        edges: reconnectEdge(oldEdge, connection, state.edges),
      }))
    },
    [],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'd') return
      if (!selectedNodeId) return
      event.preventDefault()
      duplicateNode(selectedNodeId)
    },
    [duplicateNode, selectedNodeId],
  )

  return (
    <Box
      tabIndex={0}
      onKeyDown={onKeyDown}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#0c0c0c',
        outline: 'none',
        // Connectors above node bodies; bend/remove controls stay on top.
        '& .react-flow__nodes': { zIndex: 1 },
        '& .react-flow__edges': { zIndex: 1000 },
        '& .react-flow__edgelabel-renderer': { zIndex: 1001 },
        '& .react-flow__connectionline': { zIndex: 1002 },
        // Handles still elevated within the node layer for local stacking.
        '& .react-flow__handle': { zIndex: 10 },
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        nodesConnectable
        nodesDraggable
        elementsSelectable
        edgesReconnectable
        elevateEdgesOnSelect
        fitView
        colorMode="dark"
        defaultEdgeOptions={{
          type: 'editable',
          zIndex: 1000,
          style: { stroke: 'rgba(255,255,255,0.55)', strokeWidth: 2.5 },
          reconnectable: true,
          selectable: true,
          data: { waypoints: [] },
        }}
      >
        <FitViewOnGraphChange />
        <MiniMap
          pannable
          zoomable
          style={{ background: '#1a1a1a' }}
          maskColor="rgba(0,0,0,0.55)"
        />
        <Controls />
        <Background gap={20} color="rgba(255,255,255,0.05)" />
      </ReactFlow>
    </Box>
  )
}
