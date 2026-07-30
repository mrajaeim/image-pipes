import {
  AppBar,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { PreviewGrid } from '../features/preview/PreviewGrid'
import { CodePanel } from '../features/code/CodePanel'
import { useGraphStore } from '../store/graphStore'

export default function App() {
  const seed = useGraphStore((s) => s.seed)
  const sampleCount = useGraphStore((s) => s.sampleCount)
  const setSeed = useGraphStore((s) => s.setSeed)
  const setSampleCount = useGraphStore((s) => s.setSampleCount)
  const isExecuting = useGraphStore((s) => s.isExecuting)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar
        position="static"
        elevation={0}
        color="transparent"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700 }}
          >
            Image Pipes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
            OpenCV pipeline playground
          </Typography>
          <TextField
            size="small"
            label="Seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            sx={{ width: 100 }}
          />
          <TextField
            size="small"
            label="Samples"
            type="number"
            value={sampleCount}
            onChange={(e) => setSampleCount(Number(e.target.value))}
            sx={{ width: 110 }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={isExecuting}>
              Run
            </Button>
            <Button variant="outlined" disabled={isExecuting}>
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
          gridTemplateColumns: '220px 1fr 280px',
          gridTemplateRows: '1fr 240px',
        }}
      >
        <Box sx={{ gridRow: '1 / span 2', borderRight: 1, borderColor: 'divider' }}>
          <NodePalette />
        </Box>
        <Box sx={{ minHeight: 0 }}>
          <PipelineCanvas />
        </Box>
        <Box sx={{ borderLeft: 1, borderColor: 'divider', minHeight: 0 }}>
          <NodeInspector />
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider', minHeight: 0 }}>
          <PreviewGrid />
        </Box>
        <Box sx={{ borderTop: 1, borderLeft: 1, borderColor: 'divider', minHeight: 0 }}>
          <CodePanel />
        </Box>
      </Box>
      <Divider />
    </Box>
  )
}
