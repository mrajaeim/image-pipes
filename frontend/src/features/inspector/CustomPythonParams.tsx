import { useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
} from '@mui/material'

type CustomPythonParamsProps = {
  code: string
  onCodeChange: (code: string) => void
}

const ICON_COLOR = '#f0ebe3'

const readOnlyOptions = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  fontSize: 12,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  tabSize: 4,
  automaticLayout: true,
  renderLineHighlight: 'none' as const,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  hover: { enabled: 'off' as const },
  contextmenu: false,
  accessibilitySupport: 'off' as const,
}

const editOptions = {
  ...readOnlyOptions,
  readOnly: false,
  domReadOnly: false,
  fontSize: 14,
  minimap: { enabled: true },
  renderLineHighlight: 'line' as const,
  contextmenu: true,
  // Keep IntelliSense off so typing stays predictable.
  acceptSuggestionOnEnter: 'off' as const,
  tabCompletion: 'off' as const,
  wordBasedSuggestions: 'off' as const,
  snippetSuggestions: 'none' as const,
  suggestOnTriggerCharacters: false,
  quickSuggestions: {
    other: false,
    comments: false,
    strings: false,
  },
}

function EditIcon({ color = ICON_COLOR }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill={color}
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
      />
    </svg>
  )
}

export function CustomPythonParams({ code, onCodeChange }: CustomPythonParamsProps) {
  const [editing, setEditing] = useState(false)
  const [editorSeed, setEditorSeed] = useState(code)
  const draftRef = useRef(code)

  const openEditor = () => {
    draftRef.current = code
    setEditorSeed(code)
    setEditing(true)
  }

  const closeEditor = (save: boolean) => {
    if (save) {
      onCodeChange(draftRef.current)
    }
    setEditing(false)
  }

  const onEditMount: OnMount = (ed, monaco) => {
    // React Flow skips keyboard shortcuts inside `.nokey`.
    ed.getContainerDomNode().classList.add('nokey')
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {})
    ed.focus()
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.55)', lineHeight: 1.45 }}>
        Define <code>process(image, seed=0)</code> and return a BGR numpy ndarray.{' '}
        <code>cv2</code>, <code>np</code>, and <code>numpy</code> are available. Code runs with
        full local privileges — only run workflows you trust.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 650, color: 'rgba(244,241,234,0.7)' }}>
          Code
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={openEditor}
          sx={{
            textTransform: 'none',
            fontWeight: 650,
            fontSize: 12,
            color: ICON_COLOR,
            borderColor: 'rgba(255,255,255,0.16)',
            '& .MuiButton-startIcon': { color: ICON_COLOR },
            '&:hover': {
              borderColor: 'rgba(125,206,160,0.45)',
              bgcolor: 'rgba(125,206,160,0.08)',
            },
          }}
        >
          Edit code
        </Button>
      </Box>

      <Box
        className="nokey"
        sx={{
          height: 280,
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 1,
          overflow: 'hidden',
          opacity: 0.92,
        }}
      >
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          theme="vs-dark"
          options={readOnlyOptions}
        />
      </Box>

      <Dialog
        open={editing}
        onClose={() => closeEditor(true)}
        fullScreen
        // Keep canvas shortcuts from seeing editor key events.
        className="nokey"
        slotProps={{
          paper: {
            className: 'nokey',
            sx: {
              bgcolor: '#0f0f0f',
              color: ICON_COLOR,
              backgroundImage: 'none',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          className="nokey"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              flex: 1,
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '-0.02em',
            }}
          >
            Edit Custom Python
          </Typography>
          <Button
            size="small"
            onClick={() => closeEditor(false)}
            sx={{
              textTransform: 'none',
              color: 'rgba(244,241,234,0.65)',
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => closeEditor(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 650,
              bgcolor: '#7dcea0',
              color: '#0f0f0f',
              '&:hover': { bgcolor: '#6bbd8e' },
            }}
          >
            Save
          </Button>
        </Box>
        <DialogContent
          className="nokey"
          sx={{
            p: 0,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
          // Stop React Flow (window listeners) from seeing these keys while editing.
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        >
          <Box className="nokey" sx={{ flex: 1, minHeight: 0 }}>
            {editing ? (
              <Editor
                height="100%"
                defaultLanguage="python"
                defaultValue={editorSeed}
                theme="vs-dark"
                onChange={(value) => {
                  draftRef.current = value ?? ''
                }}
                onMount={onEditMount}
                options={editOptions}
              />
            ) : null}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
