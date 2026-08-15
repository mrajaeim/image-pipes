import { Box, Button, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import { graphHasCustomCode, isCustomCodeTrusted } from '../../workflow/customCodeTrust'

export function CustomCodeTrustBanner() {
  const nodes = useGraphStore((s) => s.nodes)
  const trustedCustomCodeHash = useGraphStore((s) => s.trustedCustomCodeHash)
  const userScriptCodes = useGraphStore((s) => s.userScriptCodes)
  const openCustomCodeTrustDialog = useGraphStore((s) => s.openCustomCodeTrustDialog)

  const trusted = isCustomCodeTrusted(nodes, trustedCustomCodeHash, userScriptCodes)
  const hasCustom = graphHasCustomCode(nodes)

  if (!hasCustom || trusted) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: 'rgba(192, 57, 43, 0.14)',
        borderBottom: '1px solid rgba(192, 57, 43, 0.35)',
      }}
    >
      <Typography sx={{ flex: 1, fontSize: 13, color: '#f0ebe3', lineHeight: 1.4 }}>
        This workflow includes custom Python. Review and trust the code before running.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => openCustomCodeTrustDialog(undefined, false)}
        sx={{
          textTransform: 'none',
          fontWeight: 650,
          color: '#f0ebe3',
          borderColor: 'rgba(240,235,227,0.35)',
          whiteSpace: 'nowrap',
          '&:hover': {
            borderColor: 'rgba(240,235,227,0.55)',
            bgcolor: 'rgba(255,255,255,0.06)',
          },
        }}
      >
        Review & trust
      </Button>
    </Box>
  )
}
