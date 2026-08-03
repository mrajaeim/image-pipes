import {
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import { ProjectInfoModal } from './ProjectInfoModal'

const fieldSx = {
  width: 100,
  '& .MuiInputBase-root': {
    color: '#f0ebe3',
    bgcolor: '#0f0f0f',
    borderRadius: 1.25,
    fontSize: 13,
    height: 36,
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(244,241,234,0.45)',
    fontSize: 12,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'rgba(125,206,160,0.85)',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(255,255,255,0.18)',
  },
  '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(125,206,160,0.5)',
  },
} as const

function BrandMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        borderRadius: 1.25,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#0c0c0c',
        border: '1px solid rgba(255,255,255,0.12)',
        flexShrink: 0,
        backgroundImage:
          'linear-gradient(135deg, rgba(125,206,160,0.35), transparent 55%), linear-gradient(315deg, rgba(230,126,34,0.4), transparent 50%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 6,
          borderRadius: 0.75,
          border: '1.5px solid rgba(244,241,234,0.75)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: '#7dcea0',
          left: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: '#e67e22',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </Box>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 0.6,
        px: 1,
        py: 0.55,
        borderRadius: 1.25,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(244,241,234,0.4)',
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f4f1ea', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}

interface AppHeaderProps {
  onRun: () => void
  onRunToSelected: () => void
  onCancel: () => void
  onNewWorkflow: () => void
  onSaveWorkflow: () => void
  onSaveAsWorkflow: () => void
  onRenameWorkflow: () => void
  onImportWorkflow: () => void
  onOpenTemplates: () => void
  onOpenRecent: () => void
}

const outlineBtnSx = {
  height: 36,
  px: 1.75,
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

const menuItemSx = {
  fontSize: 13,
  fontWeight: 600,
  py: 1,
  '&:hover': { bgcolor: 'rgba(125,206,160,0.1)' },
} as const

export function AppHeader({
  onRun,
  onRunToSelected,
  onCancel,
  onNewWorkflow,
  onSaveWorkflow,
  onSaveAsWorkflow,
  onRenameWorkflow,
  onImportWorkflow,
  onOpenTemplates,
  onOpenRecent,
}: AppHeaderProps) {
  const seed = useGraphStore((s) => s.seed)
  const iterationCount = useGraphStore((s) => s.iterationCount)
  const setSeed = useGraphStore((s) => s.setSeed)
  const setIterationCount = useGraphStore((s) => s.setIterationCount)
  const isExecuting = useGraphStore((s) => s.isExecuting)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodeCount = useGraphStore((s) => s.nodes.length)
  const edgeCount = useGraphStore((s) => s.edges.length)
  const workflowName = useGraphStore((s) => s.workflowName)
  const workflowDirty = useGraphStore((s) => s.workflowDirty)
  const [infoOpen, setInfoOpen] = useState(false)
  const [workflowAnchor, setWorkflowAnchor] = useState<null | HTMLElement>(null)
  const workflowMenuOpen = Boolean(workflowAnchor)

  const closeWorkflowMenu = () => setWorkflowAnchor(null)

  const runMenuAction = (action: () => void) => {
    closeWorkflowMenu()
    action()
  }

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.1,
        minHeight: 58,
        bgcolor: '#121212',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.03), transparent), radial-gradient(ellipse 50% 120% at 0% 0%, rgba(125,206,160,0.08), transparent 55%)',
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="About Image Pipes"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.25,
            m: 0,
            p: 0.5,
            pr: 1,
            border: '1px solid transparent',
            borderRadius: 1.5,
            bgcolor: 'transparent',
            cursor: 'pointer',
            color: 'inherit',
            minWidth: 0,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          <BrandMark />
          <Box sx={{ minWidth: 0, textAlign: 'left' }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontWeight: 700,
                fontSize: 20,
                lineHeight: 1.1,
                color: '#f4f1ea',
                letterSpacing: '-0.02em',
              }}
            >
              Image Pipes
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                color: 'rgba(244,241,234,0.45)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              OpenCV pipeline playground
            </Typography>
          </Box>
        </Box>
        <IconButton
          size="small"
          aria-label="Project info"
          onClick={() => setInfoOpen(true)}
          sx={{
            width: 30,
            height: 30,
            color: 'rgba(244,241,234,0.55)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 1.25,
            fontSize: 13,
            fontWeight: 700,
            '&:hover': {
              color: '#7dcea0',
              borderColor: 'rgba(125,206,160,0.35)',
              bgcolor: 'rgba(125,206,160,0.08)',
            },
          }}
        >
          i
        </IconButton>
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' },
            flexDirection: 'column',
            minWidth: 0,
            maxWidth: 220,
            ml: 0.5,
            pl: 1.25,
            borderLeft: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(244,241,234,0.4)',
              lineHeight: 1.2,
            }}
          >
            Workflow
          </Typography>
          <Typography
            title={workflowName}
            sx={{
              fontSize: 13,
              fontWeight: 650,
              color: '#f4f1ea',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workflowName}
            {workflowDirty ? (
              <Box component="span" sx={{ color: '#e67e22', ml: 0.35 }}>
                *
              </Box>
            ) : null}
          </Typography>
        </Box>
      </Stack>

      <ProjectInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />

      <Stack
        direction="row"
        spacing={0.75}
        sx={{ display: { xs: 'none', md: 'flex' }, ml: 1 }}
      >
        <StatPill label="Nodes" value={nodeCount} />
        <StatPill label="Links" value={edgeCount} />
      </Stack>

      <Box sx={{ flex: 1 }} />

      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Tooltip
          title="Base random seed for stochastic nodes (noise, augmentations, etc.). The same seed gives reproducible results; each iteration uses seed + iteration index."
          arrow
          enterDelay={400}
        >
          <TextField
            size="small"
            label="Seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            sx={fieldSx}
          />
        </Tooltip>
        <Tooltip
          title="How many times to run the full pipeline over your image set. A batch of 10 images with Iterations=1 runs once; raise this to preview stochastic variation."
          arrow
          enterDelay={400}
        >
          <TextField
            size="small"
            label="Iterations"
            type="number"
            value={iterationCount}
            onChange={(e) => setIterationCount(Math.max(1, Number(e.target.value) || 1))}
            sx={fieldSx}
          />
        </Tooltip>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 0.75,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {isExecuting ? (
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{
              height: 36,
              px: 1.75,
              borderRadius: 1.25,
              textTransform: 'none',
              fontWeight: 700,
              color: '#ff8a80',
              borderColor: 'rgba(255,138,128,0.35)',
              '&:hover': {
                borderColor: 'rgba(255,138,128,0.6)',
                bgcolor: 'rgba(192,57,43,0.12)',
              },
            }}
          >
            Cancel
          </Button>
        ) : null}

        <Button
          variant="contained"
          disabled={isExecuting}
          onClick={onRun}
          sx={{
            height: 36,
            px: 2.25,
            borderRadius: 1.25,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 13,
            bgcolor: isExecuting ? '#5a4a3a' : '#e67e22',
            color: '#0f0f0f',
            boxShadow: isExecuting
              ? 'none'
              : '0 0 0 1px rgba(230,126,34,0.35), 0 8px 20px rgba(230,126,34,0.22)',
            '&:hover': { bgcolor: '#f39c12' },
            '&.Mui-disabled': {
              bgcolor: 'rgba(230,126,34,0.35)',
              color: 'rgba(15,15,15,0.7)',
            },
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {isExecuting ? 'Running…' : 'Run'}
          </Box>
        </Button>

        <Button
          variant="outlined"
          disabled={isExecuting || !selectedNodeId}
          onClick={onRunToSelected}
          sx={outlineBtnSx}
        >
          Run to selected
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 0.75,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Button
          variant="outlined"
          disabled={isExecuting}
          aria-haspopup="menu"
          aria-expanded={workflowMenuOpen ? 'true' : undefined}
          aria-controls={workflowMenuOpen ? 'workflow-menu' : undefined}
          onClick={(event) => setWorkflowAnchor(event.currentTarget)}
          sx={outlineBtnSx}
        >
          Workflow
          <Box component="span" sx={{ ml: 0.75, fontSize: 10, opacity: 0.7, lineHeight: 1 }}>
            ▾
          </Box>
        </Button>

        <Menu
          id="workflow-menu"
          anchorEl={workflowAnchor}
          open={workflowMenuOpen}
          onClose={closeWorkflowMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                mt: 0.75,
                minWidth: 200,
                bgcolor: '#161616',
                color: '#f4f1ea',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 1.5,
                overflow: 'hidden',
                boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                backgroundImage: 'none',
              },
            },
            list: {
              dense: true,
              sx: { py: 0.5 },
            },
          }}
        >
          <MenuItem onClick={() => runMenuAction(onNewWorkflow)} sx={menuItemSx}>
            New
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onSaveWorkflow)} sx={menuItemSx}>
            Save
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onSaveAsWorkflow)} sx={menuItemSx}>
            Export…
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onRenameWorkflow)} sx={menuItemSx}>
            Rename…
          </MenuItem>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
          <MenuItem onClick={() => runMenuAction(onImportWorkflow)} sx={menuItemSx}>
            Import…
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onOpenTemplates)} sx={menuItemSx}>
            Templates…
          </MenuItem>
          <MenuItem onClick={() => runMenuAction(onOpenRecent)} sx={menuItemSx}>
            Recent…
          </MenuItem>
        </Menu>
      </Stack>
    </Box>
  )
}
