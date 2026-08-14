import { Box, Tab, Tabs } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { PipelineCanvas } from '../features/canvas/PipelineCanvas'
import { NodePalette } from '../features/palette/NodePalette'
import { NodeInspector } from '../features/inspector/NodeInspector'
import { CodePanel } from '../features/code/CodePanel'
import { ExecutionLogPanel } from '../features/execution/ExecutionLogPanel'
import { PreviewGrid } from '../features/preview/PreviewGrid'
import { RecentWorkflowsDialog } from '../features/workflows/RecentWorkflowsDialog'
import { WorkflowNameDialog } from '../features/workflows/WorkflowNameDialog'
import { TemplateGallery } from '../features/templates/TemplateGallery'
import { useGraphStore } from '../store/graphStore'
import {
  bindExecutionRunner,
  useExecutionSocket,
} from '../hooks/useExecutionSocket'
import { useWorkflowPersistence } from '../hooks/useWorkflowPersistence'
import { notifyError, notifyInfo, notifySuccess } from '../notify'
import { downloadWorkflowJson, parseWorkflowJson } from '../workflow/io'
import { materializeSampleImages } from '../workflow/materializeSampleImages'
import {
  buildExportDocument,
  rehydrateWorkflowAssets,
} from '../workflow/workflowAssets'
import {
  confirmDiscardIfDirty,
  loadExternalDocument,
  newWorkflow,
  renameActiveWorkflow,
  saveWorkflow,
  saveWorkflowAs,
} from '../workflow/workflowActions'
import type { WorkflowTemplate } from '../workflow/templates'
import { AppHeader } from './AppHeader'
import { CustomCodeTrustBanner } from '../features/execution/CustomCodeTrustBanner'
import { CustomCodeTrustDialog } from '../features/execution/CustomCodeTrustDialog'

type NamePrompt = 'save' | 'export' | 'rename' | null

export default function App() {
  const toWorkflowDocument = useGraphStore((s) => s.toWorkflowDocument)
  const workflowId = useGraphStore((s) => s.workflowId)
  const workflowName = useGraphStore((s) => s.workflowName)
  const workflowDescription = useGraphStore((s) => s.workflowDescription)
  const nodeCatalog = useGraphStore((s) => s.nodeCatalog)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const { run, cancel } = useExecutionSocket()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [namePrompt, setNamePrompt] = useState<NamePrompt>(null)
  const [sideTab, setSideTab] = useState(0)

  useEffect(() => bindExecutionRunner(run), [run])
  useWorkflowPersistence()

  const applyLoadedWorkflow = async (
    text: string,
    successMessage: string,
    nameOverride?: string,
  ) => {
    const parsed = parseWorkflowJson(text)
    const { doc, previews } = await rehydrateWorkflowAssets(parsed)
    const { skippedTypes } = loadExternalDocument(
      doc,
      nameOverride ? { name: nameOverride } : undefined,
    )
    const { setLocalPreviews, nodes } = useGraphStore.getState()
    for (const node of nodes) {
      if (node.data.type !== 'load_image') continue
      const batchId = String(node.data.params.asset_batch_id ?? '').trim()
      const preview = batchId ? previews[batchId] : undefined
      if (preview) {
        setLocalPreviews(node.id, preview.urls, preview.files)
      }
    }
    await materializeSampleImages()
    if (skippedTypes.length > 0) {
      notifyInfo(`${successMessage} (skipped unknown nodes: ${skippedTypes.join(', ')})`)
    } else {
      notifySuccess(successMessage)
    }
  }

  const onNewWorkflow = () => {
    if (!confirmDiscardIfDirty()) return
    newWorkflow()
    notifySuccess('New workflow')
  }

  const onSaveWorkflow = () => {
    try {
      if (!workflowId) {
        setNamePrompt('save')
        return
      }
      saveWorkflow()
      notifySuccess('Workflow saved')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Save failed')
    }
  }

  const onSaveAsWorkflow = () => {
    setNamePrompt('export')
  }

  const onRenameWorkflow = () => {
    setNamePrompt('rename')
  }

  const onImportWorkflow = () => {
    if (nodeCatalog.length === 0) {
      notifyError('Node catalog is still loading — try again in a moment')
      return
    }
    if (!confirmDiscardIfDirty()) return
    fileInputRef.current?.click()
  }

  const onLoadWorkflowFile = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await applyLoadedWorkflow(text, 'Workflow imported')
      setRecentOpen(false)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Import failed')
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

  const onOpenRecent = () => {
    setRecentOpen(true)
  }

  const onConfirmNamePrompt = async (meta: { name: string; description: string }) => {
    try {
      if (namePrompt === 'save') {
        const record = saveWorkflowAs(meta)
        notifySuccess(`Saved “${record.name}”`)
      } else if (namePrompt === 'export') {
        const name = meta.name.trim() || workflowName
        const description = meta.description.trim()
        const exported = await buildExportDocument({
          ...toWorkflowDocument(),
          name,
          ...(description ? { description } : { description: undefined }),
        })
        downloadWorkflowJson(exported)
        notifySuccess(`Exported “${name}”`)
      } else if (namePrompt === 'rename') {
        renameActiveWorkflow(meta)
        notifySuccess('Workflow renamed')
      }
      setNamePrompt(null)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Could not update workflow')
    }
  }

  const onSelectTemplate = async (template: WorkflowTemplate) => {
    if (!confirmDiscardIfDirty()) return
    try {
      const response = await fetch(template.path)
      if (!response.ok) {
        throw new Error(`Could not fetch template (${response.status})`)
      }
      const text = await response.text()
      await applyLoadedWorkflow(text, `Loaded “${template.name}”`, template.name)
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
        onNewWorkflow={onNewWorkflow}
        onSaveWorkflow={onSaveWorkflow}
        onSaveAsWorkflow={onSaveAsWorkflow}
        onRenameWorkflow={onRenameWorkflow}
        onImportWorkflow={onImportWorkflow}
        onOpenTemplates={onOpenTemplates}
        onOpenRecent={onOpenRecent}
      />
      <CustomCodeTrustBanner />
      <CustomCodeTrustDialog />
      <WorkflowNameDialog
        open={namePrompt != null}
        title={
          namePrompt === 'rename'
            ? 'Rename workflow'
            : namePrompt === 'export'
              ? 'Export'
              : 'Save workflow'
        }
        confirmLabel={
          namePrompt === 'rename' ? 'Rename' : namePrompt === 'export' ? 'Export' : 'Save'
        }
        initialName={workflowName}
        initialDescription={workflowDescription}
        onClose={() => setNamePrompt(null)}
        onConfirm={(meta) => void onConfirmNamePrompt(meta)}
      />
      <RecentWorkflowsDialog
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        disabled={isExecuting}
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
            gridTemplateRows: '1fr 260px',
            minHeight: 0,
          }}
        >
          <Box sx={{ minHeight: 0, overflow: 'auto' }}>
            <NodeInspector />
          </Box>
          <Box
            sx={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Tabs
              value={sideTab}
              onChange={(_, value: number) => setSideTab(value)}
              sx={{
                minHeight: 36,
                px: 1,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                '& .MuiTab-root': {
                  minHeight: 36,
                  py: 0.5,
                  textTransform: 'none',
                  fontWeight: 650,
                  fontSize: 12,
                  color: 'rgba(244,241,234,0.45)',
                },
                '& .Mui-selected': { color: '#7dcea0' },
                '& .MuiTabs-indicator': { bgcolor: '#7dcea0', height: 2 },
              }}
            >
              <Tab label="Code" />
              <Tab label="Results" />
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              {sideTab === 0 ? <CodePanel /> : <PreviewGrid />}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
