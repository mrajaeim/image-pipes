import { useState } from 'react'
import { Button } from '@mui/material'
import { ScriptHelpersModal } from './ScriptHelpersModal'

const ICON_COLOR = '#f0ebe3'

type ScriptHelpersButtonProps = {
  /** Compact icon-style control for dense toolbars. */
  compact?: boolean
}

export function ScriptHelpersButton({ compact = false }: ScriptHelpersButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        aria-label="Script helpers"
        onClick={() => setOpen(true)}
        sx={{
          textTransform: 'none',
          fontWeight: 650,
          fontSize: compact ? 12 : 12,
          minWidth: compact ? 32 : undefined,
          px: compact ? 1 : 1.25,
          color: ICON_COLOR,
          borderColor: 'rgba(255,255,255,0.16)',
          '&:hover': {
            borderColor: 'rgba(93,173,226,0.45)',
            bgcolor: 'rgba(93,173,226,0.08)',
            color: '#5dade2',
          },
        }}
      >
        {compact ? '?' : 'Helpers'}
      </Button>
      <ScriptHelpersModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
