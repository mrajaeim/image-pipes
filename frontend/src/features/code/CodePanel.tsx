import Editor from '@monaco-editor/react'
import { Box, Button, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { requestCodegen } from '../../hooks/useExecutionSocket'
import { notifyError, notifySuccess } from '../../notify'

export const DEFAULT_GENERATED_CODE = '# Run codegen to export a Python script\n'

export function CodePanel() {
  const code = useGraphStore((s) => s.generatedCode)
  const setGeneratedCode = useGraphStore((s) => s.setGeneratedCode)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const nodeCount = useGraphStore((s) => s.nodes.length)
  const isPlaceholder = code.trim() === DEFAULT_GENERATED_CODE.trim() || !code.trim()

  const onExportPython = async () => {
    try {
      const next = await requestCodegen()
      setGeneratedCode(next)
      notifySuccess('Python script exported')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Codegen failed')
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography
        variant="subtitle1"
        sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700, px: 2, pt: 2 }}
      >
        Python Export
      </Typography>
      {isPlaceholder ? (
        <Box sx={{ flex: 1, px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ color: 'rgba(244,241,234,0.55)', fontSize: 13, lineHeight: 1.5 }}>
            Generate a standalone OpenCV script from the current pipeline.
          </Typography>
          <Button
            variant="outlined"
            disabled={isExecuting || nodeCount === 0}
            onClick={() => void onExportPython()}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontWeight: 650,
              color: '#f0ebe3',
              borderColor: 'rgba(255,255,255,0.16)',
              '&:hover': {
                borderColor: 'rgba(125,206,160,0.45)',
                bgcolor: 'rgba(125,206,160,0.08)',
              },
            }}
          >
            Export Python
          </Button>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
            }}
          />
        </Box>
      )}
    </Box>
  )
}
