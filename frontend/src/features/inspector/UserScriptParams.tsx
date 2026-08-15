import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUserScriptVersion,
  getUserScriptCode,
  listUserScripts,
} from '../../api/userScripts'
import { notifyError } from '../../notify'
import { useGraphStore } from '../../store/graphStore'
import { scriptIdFromType, userScriptCodeKey } from '../../workflow/customCodeTrust'
import { ScriptLogBox } from './ScriptLogBox'
import { ScriptHelpersButton } from './ScriptHelpersButton'

type UserScriptParamsProps = {
  nodeId: string
  nodeType: string
  label: string
  version: number
  onVersionChange: (version: number) => void
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

export function UserScriptParams({
  nodeId,
  nodeType,
  label,
  version,
  onVersionChange,
}: UserScriptParamsProps) {
  const queryClient = useQueryClient()
  const cacheUserScriptCode = useGraphStore((s) => s.cacheUserScriptCode)
  const userScriptCodes = useGraphStore((s) => s.userScriptCodes)
  const trustCustomCode = useGraphStore((s) => s.trustCustomCode)

  const scriptId = scriptIdFromType(nodeType) ?? ''
  const codeKey = userScriptCodeKey(nodeType, version)
  const code = userScriptCodes[codeKey] ?? ''
  const cached = userScriptCodes[codeKey] !== undefined

  const { data: scripts = [] } = useQuery({
    queryKey: ['user-scripts'],
    queryFn: listUserScripts,
  })
  const currentVersion =
    scripts.find((item) => item.id === scriptId)?.current_version ?? version
  const versionOptions = useMemo(() => {
    const maxVersion = Math.max(1, currentVersion, version)
    return Array.from({ length: maxVersion }, (_, index) => index + 1)
  }, [currentVersion, version])

  const [editing, setEditing] = useState(false)
  const [editorSeed, setEditorSeed] = useState(code)
  const [saving, setSaving] = useState(false)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const draftRef = useRef(code)
  const fetchError = failedKey === codeKey

  useEffect(() => {
    let cancelled = false
    if (!scriptId || cached) return
    void getUserScriptCode(scriptId, version)
      .then((resp) => {
        if (cancelled) return
        cacheUserScriptCode(nodeType, version, resp.code)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFailedKey(codeKey)
        notifyError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [scriptId, version, nodeType, cached, cacheUserScriptCode, codeKey])

  const openEditor = () => {
    draftRef.current = code
    setEditorSeed(code)
    setEditing(true)
  }

  const closeEditor = async (save: boolean) => {
    if (!save) {
      setEditing(false)
      return
    }
    if (!scriptId) return
    setSaving(true)
    try {
      const meta = await createUserScriptVersion(scriptId, draftRef.current)
      cacheUserScriptCode(nodeType, meta.current_version, draftRef.current)
      onVersionChange(meta.current_version)
      trustCustomCode()
      await queryClient.invalidateQueries({ queryKey: ['nodes'] })
      await queryClient.invalidateQueries({ queryKey: ['user-scripts'] })
      setEditing(false)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const onEditMount: OnMount = (ed, monaco) => {
    ed.getContainerDomNode().classList.add('nokey')
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {})
    ed.focus()
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(244,241,234,0.55)', lineHeight: 1.45 }}>
        Reusable script <strong>{label}</strong> ({scriptId}). Editing always creates a new
        version; this canvas node pins the version below.
      </Typography>

      <TextField
        select
        size="small"
        label="Pinned version"
        value={version}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next) && next >= 1) onVersionChange(Math.floor(next))
        }}
        helperText="Older versions stay on disk; change only if you intend to retarget."
      >
        {versionOptions.map((option) => (
          <MenuItem key={option} value={option}>
            v{option}
            {option === currentVersion ? ' (latest)' : ''}
          </MenuItem>
        ))}
      </TextField>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 650, color: 'rgba(244,241,234,0.7)' }}>
          Code (v{version})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ScriptHelpersButton />
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={openEditor}
            disabled={!cached || !code}
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
        {!cached ? (
          <Typography sx={{ p: 2, fontSize: 12, color: 'rgba(244,241,234,0.45)' }}>
            {fetchError ? 'Failed to load script.' : 'Loading script…'}
          </Typography>
        ) : (
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            theme="vs-dark"
            options={readOnlyOptions}
          />
        )}
      </Box>

      <ScriptLogBox nodeId={nodeId} />

      <Dialog
        open={editing}
        onClose={() => {
          if (!saving) void closeEditor(false)
        }}
        fullScreen
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
            Edit {label} (new version)
          </Typography>
          <ScriptHelpersButton compact />
          <Button
            size="small"
            disabled={saving}
            onClick={() => void closeEditor(false)}
            sx={{ textTransform: 'none', color: 'rgba(244,241,234,0.65)' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={saving}
            onClick={() => void closeEditor(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 650,
              bgcolor: '#7dcea0',
              color: '#0f0f0f',
              '&:hover': { bgcolor: '#6bbd8e' },
            }}
          >
            {saving ? 'Saving…' : 'Save as new version'}
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
