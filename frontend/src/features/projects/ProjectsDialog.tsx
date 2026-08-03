import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { notifyError, notifyInfo, notifySuccess } from '../../notify'
import { downloadWorkflowJson } from '../../workflow/io'
import {
  confirmDiscardIfDirty,
  deleteProjectById,
  listProjects,
  newProject,
  openProject,
  type ProjectRecord,
  renameActiveProject,
  saveProject,
  saveProjectAs,
} from '../../workflow/projectActions'

type ProjectsDialogProps = {
  open: boolean
  onClose: () => void
  onImportFile: () => void
  disabled?: boolean
}

type PromptMode = 'saveAs' | 'rename' | null

const outlineBtnSx = {
  height: 34,
  px: 1.5,
  borderRadius: 1.25,
  textTransform: 'none',
  fontWeight: 650,
  color: '#f0ebe3',
  borderColor: 'rgba(255,255,255,0.16)',
  '&:hover': {
    borderColor: 'rgba(125,206,160,0.45)',
    bgcolor: 'rgba(125,206,160,0.08)',
  },
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
} as const

function formatUpdatedAt(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function ProjectRow({
  project,
  active,
  disabled,
  onOpen,
  onDelete,
}: {
  project: ProjectRecord
  active: boolean
  disabled?: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const nodeCount = project.graph.nodes.length
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 1,
        p: 1.5,
        borderRadius: 1.75,
        border: '1px solid',
        borderColor: active ? 'rgba(125,206,160,0.45)' : 'rgba(255,255,255,0.1)',
        bgcolor: active ? 'rgba(125,206,160,0.08)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.02em',
            color: '#f4f1ea',
            lineHeight: 1.2,
          }}
        >
          {project.name}
          {active ? (
            <Box
              component="span"
              sx={{
                ml: 1,
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#7dcea0',
              }}
            >
              Open
            </Box>
          ) : null}
        </Typography>
        {project.description ? (
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 12.5,
              color: 'rgba(244,241,234,0.52)',
              lineHeight: 1.4,
            }}
          >
            {project.description}
          </Typography>
        ) : null}
        <Typography
          sx={{
            mt: 0.75,
            fontSize: 11,
            color: 'rgba(244,241,234,0.38)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {nodeCount} node{nodeCount === 1 ? '' : 's'} · Updated {formatUpdatedAt(project.updatedAt)}
        </Typography>
      </Box>
      <Stack spacing={0.75} sx={{ justifyContent: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled || active}
          onClick={onOpen}
          sx={{ ...outlineBtnSx, height: 30, px: 1.25, fontSize: 12 }}
        >
          Open
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={onDelete}
          sx={{
            ...outlineBtnSx,
            height: 30,
            px: 1.25,
            fontSize: 12,
            color: '#ff8a80',
            borderColor: 'rgba(255,138,128,0.28)',
            '&:hover': {
              borderColor: 'rgba(255,138,128,0.55)',
              bgcolor: 'rgba(192,57,43,0.12)',
            },
          }}
        >
          Delete
        </Button>
      </Stack>
    </Box>
  )
}

export function ProjectsDialog({
  open,
  onClose,
  onImportFile,
  disabled,
}: ProjectsDialogProps) {
  const projectId = useGraphStore((s) => s.projectId)
  const projectName = useGraphStore((s) => s.projectName)
  const projectDescription = useGraphStore((s) => s.projectDescription)
  const projectDirty = useGraphStore((s) => s.projectDirty)
  const toWorkflowDocument = useGraphStore((s) => s.toWorkflowDocument)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [promptMode, setPromptMode] = useState<PromptMode>(null)
  const [promptName, setPromptName] = useState('')
  const [promptDescription, setPromptDescription] = useState('')

  const refresh = () => setProjects(listProjects())

  const closePrompt = () => {
    setPromptMode(null)
    setPromptName('')
    setPromptDescription('')
  }

  const handleEnter = () => {
    refresh()
    closePrompt()
  }

  const handleClose = () => {
    closePrompt()
    onClose()
  }

  const onNew = () => {
    if (!confirmDiscardIfDirty()) return
    newProject()
    refresh()
    notifySuccess('New project')
  }

  const onOpen = (id: string) => {
    if (id === projectId && !projectDirty) {
      handleClose()
      return
    }
    if (!confirmDiscardIfDirty()) return
    try {
      const { skippedTypes } = openProject(id)
      refresh()
      if (skippedTypes.length > 0) {
        notifyInfo(`Opened project (skipped unknown nodes: ${skippedTypes.join(', ')})`)
      } else {
        notifySuccess('Project opened')
      }
      handleClose()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Could not open project')
    }
  }

  const onSave = () => {
    try {
      if (!projectId) {
        setPromptMode('saveAs')
        setPromptName(projectName)
        setPromptDescription(projectDescription)
        return
      }
      saveProject()
      refresh()
      notifySuccess('Project saved')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Save failed')
    }
  }

  const openSaveAs = () => {
    setPromptMode('saveAs')
    setPromptName(projectName)
    setPromptDescription(projectDescription)
  }

  const openRename = () => {
    setPromptMode('rename')
    setPromptName(projectName)
    setPromptDescription(projectDescription)
  }

  const submitPrompt = () => {
    const name = promptName.trim()
    if (!name) {
      notifyError('Enter a project name')
      return
    }
    try {
      if (promptMode === 'saveAs') {
        saveProjectAs({ name, description: promptDescription })
        refresh()
        notifySuccess(`Saved “${name}”`)
      } else if (promptMode === 'rename') {
        renameActiveProject({ name, description: promptDescription })
        refresh()
        notifySuccess('Project renamed')
      }
      closePrompt()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Could not update project')
    }
  }

  const onDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete “${name}” from the library? This cannot be undone.`)) {
      return
    }
    deleteProjectById(id)
    refresh()
    notifySuccess('Project deleted')
  }

  const onExport = () => {
    try {
      downloadWorkflowJson(toWorkflowDocument())
      notifySuccess('Workflow exported')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Export failed')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        transition: {
          onEnter: handleEnter,
        },
        paper: {
          sx: {
            bgcolor: '#121212',
            color: '#f4f1ea',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2.5,
            overflow: 'hidden',
            backgroundImage: `
              radial-gradient(ellipse 70% 55% at 0% 0%, rgba(125,206,160,0.14), transparent 55%),
              radial-gradient(ellipse 55% 45% at 100% 0%, rgba(230,126,34,0.1), transparent 50%),
              linear-gradient(180deg, #161616 0%, #101010 100%)
            `,
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: 3,
          pt: 2.5,
          pb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Projects
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: 'rgba(244,241,234,0.5)', maxWidth: 480 }}>
            Save named pipelines in this browser, or import and export JSON files.
            {projectDirty ? ' Current project has unsaved changes.' : ''}
          </Typography>
        </Box>
        <IconButton
          aria-label="Close projects"
          onClick={handleClose}
          size="small"
          sx={{
            color: 'rgba(244,241,234,0.55)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1.25,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#f4f1ea' },
          }}
        >
          ×
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 0.5, pb: 3 }}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ mb: 2, flexWrap: 'wrap' }}
        >
          <Button variant="outlined" disabled={disabled} onClick={onNew} sx={outlineBtnSx}>
            New
          </Button>
          <Button variant="outlined" disabled={disabled} onClick={onSave} sx={outlineBtnSx}>
            Save
          </Button>
          <Button variant="outlined" disabled={disabled} onClick={openSaveAs} sx={outlineBtnSx}>
            Save As…
          </Button>
          <Button variant="outlined" disabled={disabled} onClick={openRename} sx={outlineBtnSx}>
            Rename…
          </Button>
          <Button
            variant="outlined"
            disabled={disabled}
            onClick={onImportFile}
            sx={outlineBtnSx}
          >
            Import file…
          </Button>
          <Button variant="outlined" disabled={disabled} onClick={onExport} sx={outlineBtnSx}>
            Export JSON
          </Button>
        </Stack>

        {promptMode ? (
          <Box
            sx={{
              mb: 2,
              p: 1.75,
              borderRadius: 1.75,
              border: '1px solid rgba(125,206,160,0.3)',
              bgcolor: 'rgba(0,0,0,0.28)',
            }}
          >
            <Typography
              sx={{
                mb: 1.25,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(125,206,160,0.9)',
              }}
            >
              {promptMode === 'saveAs' ? 'Save as' : 'Rename'}
            </Typography>
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Name"
                value={promptName}
                autoFocus
                onChange={(event) => setPromptName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitPrompt()
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#f0ebe3',
                    bgcolor: '#0f0f0f',
                    borderRadius: 1.25,
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(244,241,234,0.45)' },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              />
              <TextField
                size="small"
                label="Description (optional)"
                value={promptDescription}
                onChange={(event) => setPromptDescription(event.target.value)}
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#f0ebe3',
                    bgcolor: '#0f0f0f',
                    borderRadius: 1.25,
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(244,241,234,0.45)' },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={submitPrompt}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#e67e22',
                    color: '#0f0f0f',
                    '&:hover': { bgcolor: '#f39c12' },
                  }}
                >
                  {promptMode === 'saveAs' ? 'Save' : 'Rename'}
                </Button>
                <Button variant="outlined" onClick={closePrompt} sx={outlineBtnSx}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}

        {projects.length === 0 ? (
          <Box
            sx={{
              py: 5,
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 2,
              color: 'rgba(244,241,234,0.45)',
            }}
          >
            <Typography sx={{ fontSize: 14 }}>No saved projects yet.</Typography>
            <Typography sx={{ mt: 0.75, fontSize: 12.5, color: 'rgba(244,241,234,0.35)' }}>
              Use Save As to keep the current canvas in this library.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                active={project.id === projectId}
                disabled={disabled}
                onOpen={() => onOpen(project.id)}
                onDelete={() => onDelete(project.id, project.name)}
              />
            ))}
          </Stack>
        )}

        <Typography
          sx={{
            mt: 2,
            fontSize: 11,
            color: 'rgba(244,241,234,0.35)',
            letterSpacing: '0.02em',
          }}
        >
          {projects.length} project{projects.length === 1 ? '' : 's'} in this browser
        </Typography>
      </DialogContent>
    </Dialog>
  )
}
