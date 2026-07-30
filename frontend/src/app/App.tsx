import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { CodePanel } from '../features/code/CodePanel'
import { ExecutionLogPanel } from '../features/execution/ExecutionLogPanel'
import { TemplateGallery } from '../features/templates/TemplateGallery'
import { useGraphStore } from '../store/graphStore'
import {
  bindExecutionRunner,
  requestCodegen,
  useExecutionSocket,
} from '../hooks/useExecutionSocket'
import { notifyError, notifyInfo, notifySuccess } from '../notify'
import { downloadWorkflowJson, parseWorkflowJson } from '../workflow/io'
import type { WorkflowTemplate } from '../workflow/templates'
import { AppHeader } from './AppHeader'

export default function App() {
  const setGeneratedCode = useGraphStore((s) => s.setGeneratedCode)
  const toWorkflowDocument = useGraphStore((s) => s.toWorkflowDocument)
  const loadWorkflow = useGraphStore((s) => s.loadWorkflow)
  const nodeCatalog = useGraphStore((s) => s.nodeCatalog)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const { run, cancel } = useExecutionSocket()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  useEffect(() => bindExecutionRunner(run), [run])

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

  const onOpenTemplates = () => {
    if (nodeCatalog.length === 0) {
      notifyError('Node catalog is still loading — try again in a moment')
      return
    }
    setTemplatesOpen(true)
  }

  const onSelectTemplate = async (template: WorkflowTemplate) => {
    try {
      const response = await fetch(template.path)
      if (!response.ok) {
        throw new Error(`Could not fetch template (${response.status})`)
      }
      const text = await response.text()
      applyLoadedWorkflow(text, `Loaded “${template.name}”`)
      setTemplatesOpen(false)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Template load failed')
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
        onRun={() => run()}
        onRunToSelected={() => {
          if (!selectedNodeId) {
            notifyError('Select a node first')
            return
          }
          run({ targetNodeId: selectedNodeId })
        }}
        onCancel={cancel}
        onExportPython={() => void onExportPython()}
        onExportWorkflow={onExportWorkflow}
        onLoadWorkflow={onLoadWorkflowClick}
        onOpenTemplates={onOpenTemplates}
      />
      <TemplateGallery
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={(template) => void onSelectTemplate(template)}
        disabled={isExecuting}
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
        <Box
          sx={{
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <PipelineCanvas />
          </Box>
          <ExecutionLogPanel />
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
