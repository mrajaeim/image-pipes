import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { notifyError, notifyInfo, notifySuccess } from '../../notify'
import {
  confirmDiscardIfDirty,
  deleteWorkflowById,
  listWorkflows,
  openWorkflow,
  type WorkflowRecord,
} from '../../workflow/workflowActions'

type RecentWorkflowsDialogProps = {
  open: boolean
  onClose: () => void
  disabled?: boolean
}

const outlineBtnSx = {
  height: 30,
  px: 1.25,
  borderRadius: 1.25,
  textTransform: 'none',
  fontWeight: 650,
  fontSize: 12,
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

function WorkflowRow({
  workflow,
  active,
  disabled,
  onOpen,
  onDelete,
}: {
  workflow: WorkflowRecord
  active: boolean
  disabled?: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const nodeCount = workflow.graph.nodes.length
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
          {workflow.name}
          {active ? (
            <Box
              component="span"
              sx={{
                ml: 1,
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
        {workflow.description ? (
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 12.5,
              color: 'rgba(244,241,234,0.52)',
              lineHeight: 1.4,
            }}
          >
            {workflow.description}
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
          {nodeCount} node{nodeCount === 1 ? '' : 's'} · Updated {formatUpdatedAt(workflow.updatedAt)}
        </Typography>
      </Box>
      <Stack spacing={0.75} sx={{ justifyContent: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled || active}
          onClick={onOpen}
          sx={outlineBtnSx}
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

export function RecentWorkflowsDialog({
  open,
  onClose,
  disabled,
}: RecentWorkflowsDialogProps) {
  const workflowId = useGraphStore((s) => s.workflowId)
  const workflowDirty = useGraphStore((s) => s.workflowDirty)
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])

  const refresh = () => setWorkflows(listWorkflows())

  const handleEnter = () => {
    refresh()
  }

  const onOpen = (id: string) => {
    if (id === workflowId && !workflowDirty) {
      onClose()
      return
    }
    if (!confirmDiscardIfDirty()) return
    try {
      const { skippedTypes } = openWorkflow(id)
      refresh()
      if (skippedTypes.length > 0) {
        notifyInfo(`Opened workflow (skipped unknown nodes: ${skippedTypes.join(', ')})`)
      } else {
        notifySuccess('Workflow opened')
      }
      onClose()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Could not open workflow')
    }
  }

  const onDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete “${name}” from recent workflows? This cannot be undone.`)) {
      return
    }
    deleteWorkflowById(id)
    refresh()
    notifySuccess('Workflow deleted')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
            Recent
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: 'rgba(244,241,234,0.5)', maxWidth: 480 }}>
            Open a workflow saved in this browser.
          </Typography>
        </Box>
        <IconButton
          aria-label="Close recent workflows"
          onClick={onClose}
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
        {workflows.length === 0 ? (
          <Box
            sx={{
              py: 5,
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 2,
              color: 'rgba(244,241,234,0.45)',
            }}
          >
            <Typography sx={{ fontSize: 14 }}>No saved workflows yet.</Typography>
            <Typography sx={{ mt: 0.75, fontSize: 12.5, color: 'rgba(244,241,234,0.35)' }}>
              Use Save or Save as… from the Workflow menu.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {workflows.map((workflow) => (
              <WorkflowRow
                key={workflow.id}
                workflow={workflow}
                active={workflow.id === workflowId}
                disabled={disabled}
                onOpen={() => onOpen(workflow.id)}
                onDelete={() => onDelete(workflow.id, workflow.name)}
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
          {workflows.length} workflow{workflows.length === 1 ? '' : 's'} in this browser
        </Typography>
      </DialogContent>
    </Dialog>
  )
}
