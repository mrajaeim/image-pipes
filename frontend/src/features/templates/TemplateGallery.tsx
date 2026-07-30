import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '../../workflow/templates'

type TemplateGalleryProps = {
  open: boolean
  onClose: () => void
  onSelect: (template: WorkflowTemplate) => void
  disabled?: boolean
}

export function TemplateGallery({ open, onClose, onSelect, disabled }: TemplateGalleryProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#161616',
            color: '#f4f1ea',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontWeight: 700,
          fontSize: 20,
          pb: 0.5,
        }}
      >
        Template gallery
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.5)', mb: 1.5 }}>
          Load a starter pipeline onto the canvas. Existing graph will be replaced.
        </Typography>
        <List disablePadding sx={{ mx: -1 }}>
          {WORKFLOW_TEMPLATES.map((template) => (
            <ListItemButton
              key={template.id}
              disabled={disabled}
              onClick={() => onSelect(template)}
              sx={{
                borderRadius: 1.25,
                mb: 0.5,
                alignItems: 'flex-start',
                border: '1px solid transparent',
                '&:hover': {
                  bgcolor: 'rgba(125,206,160,0.08)',
                  borderColor: 'rgba(125,206,160,0.25)',
                },
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#f4f1ea' }}>
                      {template.name}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography sx={{ fontSize: 12, color: 'rgba(244,241,234,0.5)', mt: 0.35 }}>
                    {template.description}
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  )
}
