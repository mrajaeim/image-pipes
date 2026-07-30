import { Box } from '@mui/material'
import { useRef } from 'react'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { CodePanel } from '../features/code/CodePanel'
import { useGraphStore } from '../store/graphStore'
import { requestCodegen, useExecutionSocket } from '../hooks/useExecutionSocket'
import { notifyError, notifyInfo, notifySuccess } from '../notify'
import { downloadWorkflowJson, parseWorkflowJson } from '../workflow/io'
import { AppHeader } from './AppHeader'

export default function App() {
  const setGeneratedCode = useGraphStore((s) => s.setGeneratedCode)
  const toWorkflowDocument = useGraphStore((s) => s.toWorkflowDocument)
  const loadWorkflow = useGraphStore((s) => s.loadWorkflow)
  const nodeCatalog = useGraphStore((s) => s.nodeCatalog)
  const { run, cancel } = useExecutionSocket()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onExportPython = async () => {
    try {
      const code = await requestCodegen()
      setGeneratedCode(code)
      notifySuccess('Python script exported')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Codegen failed')
    }
  }

  const onExportWorkflow = () => {
    try {
      downloadWorkflowJson(toWorkflowDocument())
      notifySuccess('Workflow exported')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Export failed')
    }
  }

  const applyLoadedWorkflow = (text: string, successMessage: string) => {
    const doc = parseWorkflowJson(text)
    const { skippedTypes } = loadWorkflow(doc)
    if (skippedTypes.length > 0) {
      notifyInfo(`${successMessage} (skipped unknown nodes: ${skippedTypes.join(', ')})`)
    } else {
      notifySuccess(successMessage)
    }
  }

  const onLoadWorkflowClick = () => {
    if (nodeCatalog.length === 0) {
      notifyError('Node catalog is still loading — try again in a moment')
      return
    }
    fileInputRef.current?.click()
  }

  const onLoadWorkflowFile = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    try {
      const text = await file.text()
      applyLoadedWorkflow(text, 'Workflow loaded')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Load failed')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onLoadExample = async () => {
    if (nodeCatalog.length === 0) {
      notifyError('Node catalog is still loading — try again in a moment')
      return
    }
    try {
      const response = await fetch('/examples/blur_canny.json')
      if (!response.ok) {
        throw new Error(`Could not fetch example (${response.status})`)
      }
      const text = await response.text()
      applyLoadedWorkflow(text, 'Example workflow loaded')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Example load failed')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0f0f0f' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void onLoadWorkflowFile(event.target.files)}
      />
      <AppHeader
        onRun={run}
        onCancel={cancel}
        onExportPython={() => void onExportPython()}
        onExportWorkflow={onExportWorkflow}
        onLoadWorkflow={onLoadWorkflowClick}
        onLoadExample={() => void onLoadExample()}
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
