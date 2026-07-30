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

  const selected = nodes.find((node) => node.id === selectedNodeId) ?? null
  const meta = catalog.find((item) => item.type === selected?.data.type)
  const fields = meta?.params ?? []
  const schema = buildSchema(fields)

  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: selected?.data.params ?? {},
  })

  useEffect(() => {
    reset(selected?.data.params ?? {})
  }, [selected?.id, selected?.data.params, reset])

  if (!selected) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Inspector
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a node to edit parameters.
        </Typography>
      </Box>
    )
  }

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
        onChange={handleSubmit((values) => updateNodeParams(selected.id, values))}
        sx={{ display: 'grid', gap: 1.5 }}
      >
        {fields.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No configurable parameters.
          </Typography>
        )}
        {fields.map((field) =>
          field.type === 'select' && field.options ? (
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
          ) : (
            <TextField
              key={field.name}
              size="small"
              label={field.label}
              type={field.type === 'string' ? 'text' : 'number'}
              helperText={formState.errors[field.name]?.message as string | undefined}
              {...register(field.name)}
            />
          ),
        )}
      </Box>
    </Box>
  )
}
