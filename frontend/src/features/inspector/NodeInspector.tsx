import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useGraphStore } from '../../store/graphStore'
import type { ParamField } from '../../types'
import { FileParamInput } from './FileParamInput'

function buildSchema(fields: ParamField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    if (field.type === 'number' || field.type === 'integer') {
      let schema = z.coerce.number()
      if (field.minimum != null) schema = schema.min(field.minimum)
      if (field.maximum != null) schema = schema.max(field.maximum)
      shape[field.name] = schema
    } else if (field.type === 'select' && field.options) {
      shape[field.name] = z.enum(field.options as [string, ...string[]])
    } else {
      shape[field.name] = z.string()
    }
  }
  return z.object(shape)
}

export function NodeInspector() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const catalog = useGraphStore((s) => s.nodeCatalog)
  const updateNodeParams = useGraphStore((s) => s.updateNodeParams)
  const setLocalPreviews = useGraphStore((s) => s.setLocalPreviews)
  const removeLocalPreview = useGraphStore((s) => s.removeLocalPreview)
  const setSampleCount = useGraphStore((s) => s.setSampleCount)

  const selected = nodes.find((node) => node.id === selectedNodeId) ?? null
  const meta = catalog.find((item) => item.type === selected?.data.type)
  const fields = meta?.params ?? []
  const schema = buildSchema(fields)

  const { register, handleSubmit, reset, setValue, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: selected?.data.params ?? {},
  })

  useEffect(() => {
    reset(selected?.data.params ?? {})
  }, [selected?.id, selected?.data.params, reset])

  if (!selected) {
    const nodeCount = nodes.length
    return (
      <Box sx={{ p: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700, mb: 1 }}
        >
          Inspector
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(244,241,234,0.55)', mb: 2, lineHeight: 1.5 }}>
          {nodeCount === 0
            ? 'Drag a node from the palette, or load the Example pipeline to get started.'
            : 'Click a node on the canvas to edit its parameters here.'}
        </Typography>
        <Box
          component="ul"
          sx={{
            m: 0,
            pl: 2,
            color: 'rgba(244,241,234,0.45)',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <li>Connect green inputs to orange outputs</li>
          <li>Press Run to execute with live previews</li>
          <li>Export saves workflow JSON; Export Python codegen</li>
        </Box>
      </Box>
    )
  }

  const commit = handleSubmit((values) => updateNodeParams(selected.id, values))

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {selected.data.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {selected.data.type}
      </Typography>
      <Box
        component="form"
        onChange={() => void commit()}
        sx={{ display: 'grid', gap: 1.5 }}
      >
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No configurable parameters.
          </Typography>
        )}
        {fields.map((field) => {
          if (field.type === 'file') {
            return (
              <FileParamInput
                key={field.name}
                field={field}
                value={String(selected.data.params[field.name] ?? '')}
                previewUrls={selected.data.localPreviewUrls ?? []}
                uploadedFiles={selected.data.uploadedFiles ?? []}
                onChange={(path) => {
                  setValue(field.name, path, { shouldDirty: true, shouldValidate: true })
                  updateNodeParams(selected.id, { [field.name]: path })
                }}
                onPreviews={(urls, files) => setLocalPreviews(selected.id, urls, files)}
                onRemovePreview={(index) => {
                  const result = removeLocalPreview(selected.id, index)
                  if (!result) return
                  setValue(field.name, result.path, { shouldDirty: true, shouldValidate: true })
                  if (!result.file) return
                  void fetch(`/api/uploads?path=${encodeURIComponent(result.file)}`, {
                    method: 'DELETE',
                  })
                }}
                onBatchCount={(count) => {
                  setSampleCount(Math.max(1, count))
                }}
              />
            )
          }
          if (field.type === 'select' && field.options) {
            return (
              <TextField
                key={field.name}
                select
                size="small"
                label={field.label}
                defaultValue={String(selected.data.params[field.name] ?? field.default ?? '')}
                {...register(field.name)}
              >
                {field.options.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )
          }
          return (
            <TextField
              key={field.name}
              size="small"
              label={field.label}
              type={field.type === 'string' ? 'text' : 'number'}
              helperText={formState.errors[field.name]?.message as string | undefined}
              {...register(field.name)}
            />
          )
        })}
      </Box>
    </Box>
  )
}
