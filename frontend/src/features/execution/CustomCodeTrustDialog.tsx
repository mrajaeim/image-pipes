import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import {
  listCustomPythonNodes,
  truncateCodePreview,
} from '../../workflow/customCodeTrust'
import { runPipeline } from '../../hooks/useExecutionSocket'

export function CustomCodeTrustDialog() {
  const open = useGraphStore((s) => s.customCodeTrustDialogOpen)
  const nodes = useGraphStore((s) => s.nodes)
  const pendingRunOptions = useGraphStore((s) => s.pendingRunOptions)
  const pendingRunAfterTrust = useGraphStore((s) => s.pendingRunAfterTrust)
  const trustCustomCode = useGraphStore((s) => s.trustCustomCode)
  const closeCustomCodeTrustDialog = useGraphStore((s) => s.closeCustomCodeTrustDialog)

  const customNodes = listCustomPythonNodes(nodes)

  const onConfirm = () => {
    const options = pendingRunOptions
    const shouldRun = pendingRunAfterTrust
    trustCustomCode()
    closeCustomCodeTrustDialog()
    if (shouldRun) {
      runPipeline(options ?? undefined)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={closeCustomCodeTrustDialog}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#161616',
            color: '#f0ebe3',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogContent sx={{ pt: 2.5, pb: 2.5, px: 2.5 }}>
        <Typography
          sx={{
            mb: 1,
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-0.02em',
          }}
        >
          Trust custom Python?
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.6)', lineHeight: 1.5, mb: 2 }}>
          This workflow includes Custom Python nodes. The code runs on your machine with full
          access (same as any local script). Only continue if you reviewed the code and trust
          its source.
        </Typography>

        <Stack spacing={1.25} sx={{ mb: 2.25, maxHeight: 220, overflow: 'auto' }}>
          {customNodes.map((node) => (
            <Box
              key={node.id}
              sx={{
                p: 1.25,
                borderRadius: 1.25,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 650, mb: 0.5 }}>
                {node.data.label ?? 'Custom Python'}{' '}
                <Typography component="span" sx={{ color: 'rgba(244,241,234,0.4)', fontWeight: 500 }}>
                  ({node.id})
                </Typography>
              </Typography>
              <Typography
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 11,
                  color: 'rgba(244,241,234,0.55)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {truncateCodePreview(String(node.data.params.code ?? ''), 160)}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            onClick={closeCustomCodeTrustDialog}
            sx={{ textTransform: 'none', color: 'rgba(244,241,234,0.65)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            sx={{
              textTransform: 'none',
              fontWeight: 650,
              bgcolor: '#c0392b',
              '&:hover': { bgcolor: '#a93226' },
            }}
          >
            {pendingRunAfterTrust ? 'Trust and run' : 'Trust'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
