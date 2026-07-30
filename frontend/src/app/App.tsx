import {
  AppBar,
  Box,
  Button,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { CodePanel } from '../features/code/CodePanel'
import { useGraphStore } from '../store/graphStore'
import { requestCodegen, useExecutionSocket } from '../hooks/useExecutionSocket'

export default function App() {
  const seed = useGraphStore((s) => s.seed)
  const sampleCount = useGraphStore((s) => s.sampleCount)
  const setSeed = useGraphStore((s) => s.setSeed)
  const setSampleCount = useGraphStore((s) => s.setSampleCount)
  const isExecuting = useGraphStore((s) => s.isExecuting)
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
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: '#161616', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700, color: '#f4f1ea' }}
          >
            Image Pipes
          </Typography>
          <Typography variant="body2" sx={{ mr: 'auto', color: 'rgba(244,241,234,0.55)' }}>
            Image-first OpenCV playground
          </Typography>
          <TextField
            size="small"
            label="Seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            sx={{
              width: 100,
              '& .MuiInputBase-root': { color: '#eee', bgcolor: '#222' },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
            }}
          />
          <TextField
            size="small"
            label="Samples"
            type="number"
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
            sx={{
              width: 110,
              '& .MuiInputBase-root': { color: '#eee', bgcolor: '#222' },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="warning" disabled={isExecuting} onClick={run}>
              Run
            </Button>
            {isExecuting && (
              <Button variant="outlined" color="inherit" onClick={cancel}>
                Cancel
              </Button>
            )}
            <Button
              variant="outlined"
              disabled={isExecuting}
              onClick={() => void onExport()}
              sx={{ color: '#eee', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Export Python
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '200px minmax(0, 1fr) 300px',
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
