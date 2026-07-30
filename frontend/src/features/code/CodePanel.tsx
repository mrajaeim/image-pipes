import Editor from '@monaco-editor/react'
import { Box, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'

export function CodePanel() {
  const code = useGraphStore((s) => s.generatedCode)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, px: 2, pt: 2 }}>
        Python Export
      </Typography>
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
    </Box>
  )
}
