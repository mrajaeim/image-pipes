import type { ReactNode } from 'react'
import {
  MaterialDesignContent,
  SnackbarProvider,
  closeSnackbar,
  type CustomContentProps,
} from 'notistack'
import { Box, IconButton } from '@mui/material'
import { forwardRef } from 'react'

const baseContentSx = {
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: '10px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.08)',
} as const

const StyledContent = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const variant = props.variant ?? 'default'
  const colors: Record<string, { bg: string; fg: string }> = {
    success: { bg: '#1b3d2f', fg: '#b8f0cf' },
    error: { bg: '#3d1b1b', fg: '#ffb4a8' },
    info: { bg: '#1b2a3d', fg: '#a8d4ff' },
    warning: { bg: '#3d2e1b', fg: '#ffd59a' },
    default: { bg: '#1e1e1e', fg: '#f4f1ea' },
  }
  const tone = colors[variant] ?? colors.default

  return (
    <MaterialDesignContent
      ref={ref}
      {...props}
      style={{
        ...baseContentSx,
        backgroundColor: tone.bg,
        color: tone.fg,
      }}
    />
  )
})
StyledContent.displayName = 'StyledSnackbarContent'

function DismissButton({ snackbarId }: { snackbarId: string | number }) {
  return (
    <IconButton
      size="small"
      aria-label="Dismiss"
      onClick={() => closeSnackbar(snackbarId)}
      sx={{ color: 'inherit', opacity: 0.7, '&:hover': { opacity: 1 } }}
    >
      <Box component="span" sx={{ fontSize: 14, lineHeight: 1 }}>
        ×
      </Box>
    </IconButton>
  )
}

export function AppSnackbarProvider({ children }: { children: ReactNode }) {
  return (
    <SnackbarProvider
      maxSnack={4}
      dense
      preventDuplicate
      autoHideDuration={4000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      action={(key) => <DismissButton snackbarId={key} />}
      Components={{
        success: StyledContent,
        error: StyledContent,
        info: StyledContent,
        warning: StyledContent,
        default: StyledContent,
      }}
    >
      {children}
    </SnackbarProvider>
  )
}
