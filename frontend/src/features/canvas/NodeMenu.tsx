import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'
/* eslint-disable react-refresh/only-export-components -- hook + private menu UI helpers */
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { runPipeline } from '../../hooks/useExecutionSocket'

type MenuAnchor =
  | { kind: 'element'; el: HTMLElement }
  | { kind: 'position'; top: number; left: number }

function MenuGlyph({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        width: 28,
        height: 28,
        borderRadius: 1,
        display: 'grid',
        placeItems: 'center',
        bgcolor: danger ? 'rgba(192,57,43,0.18)' : 'rgba(255,255,255,0.06)',
        color: danger ? '#ff8a80' : 'rgba(255,255,255,0.85)',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  )
}

function ShortcutHint({ keys }: { keys: string }) {
  return (
    <Typography
      component="span"
      sx={{
        ml: 2,
        color: 'rgba(255,255,255,0.38)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      {keys}
    </Typography>
  )
}

export function useNodeMenu({
  nodeId,
  label,
  category,
}: {
  nodeId: string
  label: string
  category: string
}) {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const removeNode = useGraphStore((state) => state.removeNode)
  const duplicateNode = useGraphStore((state) => state.duplicateNode)
  const selectNode = useGraphStore((state) => state.selectNode)
  const isExecuting = useGraphStore((state) => state.isExecuting)
  const open = Boolean(anchor)
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const modKey = isMac ? '⌘' : 'Ctrl'

  const close = useCallback(() => setAnchor(null), [])

  const openFromButton = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation()
      event.preventDefault()
      selectNode(nodeId)
      setAnchor({ kind: 'element', el: event.currentTarget })
    },
    [nodeId, selectNode],
  )

  const openFromContext = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      selectNode(nodeId)
      setAnchor({ kind: 'position', top: event.clientY, left: event.clientX })
    },
    [nodeId, selectNode],
  )

  const runToHere = useCallback(() => {
    close()
    if (isExecuting) return
    runPipeline({ targetNodeId: nodeId })
  }, [close, isExecuting, nodeId])

  const runFromButton = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation()
      event.preventDefault()
      if (isExecuting) return
      selectNode(nodeId)
      runPipeline({ targetNodeId: nodeId })
    },
    [isExecuting, nodeId, selectNode],
  )

  const runDuplicate = useCallback(() => {
    duplicateNode(nodeId)
    close()
  }, [close, duplicateNode, nodeId])

  const runDelete = useCallback(() => {
    removeNode(nodeId)
    close()
  }, [close, nodeId, removeNode])

  const headerButtonSx = {
    width: 28,
    height: 28,
    color: 'rgba(255,255,255,0.55)',
    bgcolor: 'transparent',
    border: '1px solid',
    borderColor: 'transparent',
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
    '&:hover': {
      color: '#fff',
      bgcolor: 'rgba(255,255,255,0.1)',
      borderColor: 'rgba(255,255,255,0.14)',
    },
    '&.Mui-disabled': {
      color: 'rgba(255,255,255,0.25)',
    },
  } as const

  return {
    openFromContext,
    menu: (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          <IconButton
            size="small"
            className="nodrag nopan"
            aria-label="Run to here"
            disabled={isExecuting}
            onClick={runFromButton}
            onMouseDown={(event) => event.stopPropagation()}
            sx={headerButtonSx}
          >
            <Box
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                ml: '1px',
              }}
            >
              ▶
            </Box>
          </IconButton>

          <IconButton
            size="small"
            className="nodrag nopan"
            aria-label="Node actions"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={openFromButton}
            onMouseDown={(event) => event.stopPropagation()}
            sx={{
              ...headerButtonSx,
              bgcolor: open ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderColor: open ? 'rgba(255,255,255,0.16)' : 'transparent',
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'grid',
                gap: '3px',
                placeItems: 'center',
              }}
            >
              {[0, 1, 2].map((dot) => (
                <Box
                  key={dot}
                  sx={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    bgcolor: 'currentColor',
                  }}
                />
              ))}
            </Box>
          </IconButton>
        </Box>

        <Menu
          className="nodrag nopan"
          open={open}
          onClose={close}
          onClick={(event) => event.stopPropagation()}
          anchorReference={anchor?.kind === 'position' ? 'anchorPosition' : 'anchorEl'}
          anchorEl={anchor?.kind === 'element' ? anchor.el : undefined}
          anchorPosition={
            anchor?.kind === 'position'
              ? { top: anchor.top, left: anchor.left }
              : undefined
          }
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                mt: anchor?.kind === 'element' ? 0.75 : 0,
                minWidth: 220,
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
          <Box
            sx={{
              px: 1.5,
              pt: 1.25,
              pb: 1,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.42)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              {category}
            </Typography>
            <Typography
              sx={{
                mt: 0.25,
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 190,
              }}
            >
              {label}
            </Typography>
          </Box>

          <MenuItem
            className="nodrag nopan"
            disabled={isExecuting}
            onClick={runToHere}
            sx={{
              mx: 0.5,
              mt: 0.5,
              borderRadius: 1,
              py: 1,
              '&:hover': { bgcolor: 'rgba(230,126,34,0.14)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <MenuGlyph>▶</MenuGlyph>
            </ListItemIcon>
            <ListItemText
              primary="Run to here"
              slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600 } } }}
            />
          </MenuItem>

          <MenuItem
            className="nodrag nopan"
            onClick={runDuplicate}
            sx={{
              mx: 0.5,
              mt: 0.5,
              borderRadius: 1,
              py: 1,
              '&:hover': { bgcolor: 'rgba(125,206,160,0.12)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <MenuGlyph>⎘</MenuGlyph>
            </ListItemIcon>
            <ListItemText
              primary="Duplicate"
              slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600 } } }}
            />
            <ShortcutHint keys={`${modKey}+D`} />
          </MenuItem>

          <Divider sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.08)' }} />

          <MenuItem
            className="nodrag nopan"
            onClick={runDelete}
            sx={{
              mx: 0.5,
              mb: 0.5,
              borderRadius: 1,
              py: 1,
              color: '#ff8a80',
              '&:hover': { bgcolor: 'rgba(192,57,43,0.16)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <MenuGlyph danger>⌫</MenuGlyph>
            </ListItemIcon>
            <ListItemText
              primary="Delete"
              slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600, color: '#ff8a80' } } }}
            />
            <ShortcutHint keys="Del" />
          </MenuItem>
        </Menu>
      </>
    ),
  }
}
