import { Box } from '@mui/material'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { CodePanel } from '../features/code/CodePanel'
import { useGraphStore } from '../store/graphStore'
import { requestCodegen, useExecutionSocket } from '../hooks/useExecutionSocket'
import { AppHeader } from './AppHeader'

export default function App() {
  const setGeneratedCode = useGraphStore((s) => s.setGeneratedCode)
  const appendLog = useGraphStore((s) => s.appendLog)
  const { run, cancel } = useExecutionSocket()

  const onExport = async () => {
    try {
      const code = await requestCodegen()
      setGeneratedCode(code)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : 'Codegen failed')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0f0f0f' }}>
      <AppHeader
        onRun={run}
        onCancel={cancel}
        onExport={() => void onExport()}
      />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr) 300px',
        }}
      >
        <Box sx={{ borderRight: '1px solid rgba(255,255,255,0.08)', bgcolor: '#141414', overflow: 'auto' }}>
          <NodePalette />
        </Box>
        <Box sx={{ minHeight: 0, minWidth: 0 }}>
          <PipelineCanvas />
        </Box>
        <Box
          sx={{
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#141414',
            display: 'grid',
            gridTemplateRows: '1fr 220px',
            minHeight: 0,
          }}
        >
          <Box sx={{ minHeight: 0, overflow: 'auto' }}>
            <NodeInspector />
          </Box>
          <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', minHeight: 0 }}>
            <CodePanel />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
