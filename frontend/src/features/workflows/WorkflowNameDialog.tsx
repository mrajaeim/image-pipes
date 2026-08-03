import { useState } from 'react'
import { Box, Button, Dialog, DialogContent, Stack, TextField, Typography } from '@mui/material'

type WorkflowNameDialogProps = {
  open: boolean
  title: string
  confirmLabel: string
  initialName: string
  initialDescription?: string
  onClose: () => void
  onConfirm: (meta: { name: string; description: string }) => void
}

const fieldSx = {
  '& .MuiInputBase-root': {
    color: '#f0ebe3',
    bgcolor: '#0f0f0f',
    borderRadius: 1.25,
  },
  '& .MuiInputLabel-root': { color: 'rgba(244,241,234,0.45)' },
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

function WorkflowNameForm({
  title,
  confirmLabel,
  initialName,
  initialDescription = '',
  onClose,
  onConfirm,
}: Omit<WorkflowNameDialogProps, 'open'>) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm({ name: trimmed, description: description.trim() })
  }

  return (
    <DialogContent sx={{ pt: 2.5, pb: 2.5, px: 2.5 }}>
      <Typography
        sx={{
          mb: 1.75,
          fontFamily: '"Fraunces", Georgia, serif',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          size="small"
          label="Name"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          sx={fieldSx}
        />
        <TextField
          size="small"
          label="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          sx={fieldSx}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 0.5 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{
              textTransform: 'none',
              fontWeight: 650,
              color: '#f0ebe3',
              borderColor: 'rgba(255,255,255,0.16)',
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!name.trim()}
            onClick={submit}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#e67e22',
              color: '#0f0f0f',
              '&:hover': { bgcolor: '#f39c12' },
            }}
          >
            {confirmLabel}
          </Button>
        </Box>
      </Stack>
    </DialogContent>
  )
}

export function WorkflowNameDialog({
  open,
  title,
  confirmLabel,
  initialName,
  initialDescription = '',
  onClose,
  onConfirm,
}: WorkflowNameDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#121212',
            color: '#f4f1ea',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            backgroundImage: 'none',
          },
        },
      }}
    >
      {open ? (
        <WorkflowNameForm
          key={`${title}:${initialName}:${initialDescription}`}
          title={title}
          confirmLabel={confirmLabel}
          initialName={initialName}
          initialDescription={initialDescription}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  )
}
