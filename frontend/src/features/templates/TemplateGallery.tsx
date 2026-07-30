import { useMemo, useState } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import {
  TEMPLATE_CATEGORY_META,
  WORKFLOW_TEMPLATES,
  type TemplateCategory,
  type WorkflowTemplate,
} from '../../workflow/templates'

type TemplateGalleryProps = {
  open: boolean
  onClose: () => void
  onSelect: (template: WorkflowTemplate) => void
  disabled?: boolean
}

const ALL_FILTER = 'all' as const
type FilterId = typeof ALL_FILTER | TemplateCategory

const FILTERS: { id: FilterId; label: string }[] = [
  { id: ALL_FILTER, label: 'All' },
  ...Object.entries(TEMPLATE_CATEGORY_META).map(([id, meta]) => ({
    id: id as TemplateCategory,
    label: meta.label,
  })),
]

function PipelineRibbon({ steps, accent }: { steps: string[]; accent: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.6,
        minHeight: 28,
      }}
    >
      {steps.map((step, index) => (
        <Box key={`${step}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box
            component="span"
            sx={{
              px: 0.85,
              py: 0.3,
              borderRadius: 0.75,
              bgcolor: `${accent}22`,
              border: `1px solid ${accent}55`,
              color: '#f4f1ea',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            {step}
          </Box>
          {index < steps.length - 1 && (
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 10,
                height: 1,
                bgcolor: `${accent}66`,
                flex: '0 0 auto',
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}

function TemplateTile({
  template,
  disabled,
  onSelect,
}: {
  template: WorkflowTemplate
  disabled?: boolean
  onSelect: () => void
}) {
  const meta = TEMPLATE_CATEGORY_META[template.category]
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onSelect}
      sx={{
        appearance: 'none',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        m: 0,
        p: 0,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.02)',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 168,
        transition:
          'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
        '&:hover:not(:disabled)': {
          transform: 'translateY(-3px)',
          borderColor: `${meta.accent}88`,
          bgcolor: `${meta.accent}10`,
          boxShadow: `0 12px 28px rgba(0,0,0,0.35), 0 0 0 1px ${meta.accent}33`,
        },
        '&:focus-visible': {
          outline: `2px solid ${meta.accent}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 1.75,
          pt: 1.5,
          pb: 1.25,
          background: `linear-gradient(145deg, ${meta.accent}28 0%, transparent 62%),
            radial-gradient(ellipse 90% 80% at 100% 0%, ${meta.accent}18, transparent 55%)`,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: meta.accent,
            mb: 1,
          }}
        >
          {meta.label}
        </Typography>
        <PipelineRibbon steps={template.steps} accent={meta.accent} />
      </Box>
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.6, flex: 1 }}>
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
          {template.name}
        </Typography>
        <Typography
          sx={{
            fontSize: 12.5,
            color: 'rgba(244,241,234,0.52)',
            lineHeight: 1.45,
            flex: 1,
          }}
        >
          {template.description}
        </Typography>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: 11,
            fontWeight: 600,
            color: meta.accent,
            opacity: 0.9,
          }}
        >
          Load pipeline →
        </Typography>
      </Box>
    </Box>
  )
}

export function TemplateGallery({ open, onClose, onSelect, disabled }: TemplateGalleryProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>(ALL_FILTER)

  const handleClose = () => {
    setQuery('')
    setFilter(ALL_FILTER)
    onClose()
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return WORKFLOW_TEMPLATES.filter((template) => {
      if (filter !== ALL_FILTER && template.category !== filter) return false
      if (!needle) return true
      const haystack = [
        template.name,
        template.description,
        template.category,
        ...template.steps,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [filter, query])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
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
            Starter pipelines
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: 'rgba(244,241,234,0.5)', maxWidth: 520 }}>
            Drop a ready-made graph onto the canvas. Your current workflow will be replaced.
          </Typography>
        </Box>
        <IconButton
          aria-label="Close templates"
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.25,
            alignItems: { sm: 'center' },
            mb: 2,
          }}
        >
          <TextField
            size="small"
            placeholder="Search templates…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.35)' }}>⌕</Typography>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              maxWidth: { sm: 280 },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0,0,0,0.35)',
                color: '#f4f1ea',
                borderRadius: 1.5,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(125,206,160,0.55)' },
              },
            }}
          />
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.75,
              flex: 1,
            }}
          >
            {FILTERS.map((item) => {
              const active = filter === item.id
              const accent =
                item.id === ALL_FILTER
                  ? '#7dcea0'
                  : TEMPLATE_CATEGORY_META[item.id].accent
              return (
                <Box
                  key={item.id}
                  component="button"
                  type="button"
                  onClick={() => setFilter(item.id)}
                  sx={{
                    appearance: 'none',
                    border: '1px solid',
                    borderColor: active ? `${accent}99` : 'rgba(255,255,255,0.12)',
                    bgcolor: active ? `${accent}22` : 'transparent',
                    color: active ? '#f4f1ea' : 'rgba(244,241,234,0.55)',
                    px: 1.1,
                    py: 0.45,
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease',
                    '&:hover': {
                      borderColor: `${accent}88`,
                      color: '#f4f1ea',
                    },
                  }}
                >
                  {item.label}
                </Box>
              )
            })}
          </Box>
        </Box>

        {filtered.length === 0 ? (
          <Box
            sx={{
              py: 6,
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 2,
              color: 'rgba(244,241,234,0.45)',
            }}
          >
            <Typography sx={{ fontSize: 14 }}>No templates match that search.</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 1.5,
              '@media (min-width: 900px)': {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              },
              '@keyframes templateTileIn': {
                from: { opacity: 0, transform: 'translateY(8px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              '& > *': {
                animation: 'templateTileIn 280ms ease both',
              },
              '& > *:nth-of-type(1)': { animationDelay: '0ms' },
              '& > *:nth-of-type(2)': { animationDelay: '40ms' },
              '& > *:nth-of-type(3)': { animationDelay: '80ms' },
              '& > *:nth-of-type(4)': { animationDelay: '120ms' },
              '& > *:nth-of-type(5)': { animationDelay: '160ms' },
              '& > *:nth-of-type(6)': { animationDelay: '200ms' },
              '& > *:nth-of-type(7)': { animationDelay: '240ms' },
              '& > *:nth-of-type(8)': { animationDelay: '280ms' },
            }}
          >
            {filtered.map((template) => (
              <TemplateTile
                key={template.id}
                template={template}
                disabled={disabled}
                onSelect={() => onSelect(template)}
              />
            ))}
          </Box>
        )}

        <Typography
          sx={{
            mt: 2,
            fontSize: 11,
            color: 'rgba(244,241,234,0.35)',
            letterSpacing: '0.02em',
          }}
        >
          {filtered.length} of {WORKFLOW_TEMPLATES.length} starters
        </Typography>
      </DialogContent>
    </Dialog>
  )
}
