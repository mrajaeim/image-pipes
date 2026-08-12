import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { SaveImageParams } from './SaveImageParams'
import { AnnotationsParams } from './AnnotationsParams'

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

  const selected = nodes.find((node) => node.id === selectedNodeId) ?? null
  const meta = catalog.find((item) => item.type === selected?.data.type)
  const fields = meta?.params ?? []
  const schema = buildSchema(fields)
  const isSaveImage = selected?.data.type === 'save_image'
  const isLoadImage = selected?.data.type === 'load_image'
  const isAnnotations = selected?.data.type === 'annotations'

  const { register, handleSubmit, reset, control, setValue, formState } = useForm({
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
          <li>Connect matching port types (image, mask, bboxes, keypoints)</li>
          <li>Press Run to execute with live previews</li>
          <li>Workflow menu: save, import, templates, and recent pipelines</li>
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
        {isSaveImage ? (
          <SaveImageParams
            filename={String(
              selected.data.params.filename ?? '{filename}_{index}.png',
            )}
            outputDir={String(selected.data.params.output_dir ?? '')}
            packaging={
              selected.data.params.packaging === 'zip' ? 'zip' : 'bare'
            }
            onFilenameChange={(filename) => {
              setValue('filename', filename, { shouldDirty: true, shouldValidate: true })
              updateNodeParams(selected.id, { filename })
            }}
            onOutputDirChange={(outputDir) => {
              setValue('output_dir', outputDir, { shouldDirty: true, shouldValidate: true })
              updateNodeParams(selected.id, { output_dir: outputDir })
            }}
            onPackagingChange={(packaging) => {
              setValue('packaging', packaging, { shouldDirty: true, shouldValidate: true })
              updateNodeParams(selected.id, { packaging })
            }}
          />
        ) : isLoadImage ? (
          <FileParamInput
            field={{
              name: 'images',
              label: 'Images / Folder',
              type: 'file',
              default: '',
              accept: ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp', '.gif'],
              description: 'Select multiple images or a folder of images',
            }}
            assetBatchId={String(selected.data.params.asset_batch_id ?? '')}
            previewUrls={selected.data.localPreviewUrls ?? []}
            uploadedFiles={selected.data.uploadedFiles ?? []}
            onAssetBatchId={(batchId) => {
              setValue('asset_batch_id', batchId, {
                shouldDirty: true,
                shouldValidate: true,
              })
              updateNodeParams(selected.id, {
                asset_batch_id: batchId,
                sample: '',
              })
            }}
            onPreviews={(urls, files) => setLocalPreviews(selected.id, urls, files)}
            onRemovePreview={(index) => {
              const prevBatchId = String(selected.data.params.asset_batch_id ?? '')
              const result = removeLocalPreview(selected.id, index)
              if (!result) return
              setValue('asset_batch_id', result.assetBatchId, {
                shouldDirty: true,
                shouldValidate: true,
              })
              if (!result.file) return
              if (prevBatchId) {
                const name = result.file.replace(/^.*[\\/]/, '')
                void fetch(
                  `/api/assets/${prevBatchId}/files/${encodeURIComponent(name)}`,
                  { method: 'DELETE' },
                )
              } else {
                void fetch(`/api/uploads?path=${encodeURIComponent(result.file)}`, {
                  method: 'DELETE',
                })
              }
            }}
          />
        ) : isAnnotations ? (
          <AnnotationsParams
            key={selected.id}
            bboxesJson={String(
              selected.data.params.bboxes_json ?? '[[10, 10, 100, 80, "object"]]',
            )}
            keypointsJson={String(
              selected.data.params.keypoints_json ?? '[[40, 40], [80, 60]]',
            )}
            onChange={(next) => {
              setValue('bboxes_json', next.bboxes_json, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setValue('keypoints_json', next.keypoints_json, {
                shouldDirty: true,
                shouldValidate: true,
              })
              updateNodeParams(selected.id, next)
            }}
          />
        ) : (
          <>
            {fields.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No configurable parameters.
              </Typography>
            )}
            {fields.map((field) => {
              if (
                field.name === 'asset_batch_id' ||
                field.name === 'sample' ||
                field.name === 'output_dir' ||
                field.name === 'packaging'
              ) {
                return null
              }
              if (field.type === 'file') {
                return null
              }
              if (field.type === 'select' && field.options) {
                const options = field.options
                return (
                  <Controller
                    key={`${selected.id}:${field.name}`}
                    name={field.name}
                    control={control}
                    render={({ field: inputField }) => (
                      <TextField
                        select
                        size="small"
                        label={field.label}
                        helperText={field.description ?? undefined}
                        value={String(selected.data.params[field.name] ?? '')}
                        onChange={(event) => {
                          const value = event.target.value
                          inputField.onChange(value)
                          setValue(field.name, value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          updateNodeParams(selected.id, { [field.name]: value })
                        }}
                        onBlur={inputField.onBlur}
                      >
                        {options.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                )
              }

              const errorText = formState.errors[field.name]?.message as string | undefined

              return (
                <TextField
                  key={`${selected.id}:${field.name}`}
                  size="small"
                  label={field.label}
                  type={field.type === 'string' ? 'text' : 'number'}
                  helperText={errorText ?? field.description ?? undefined}
                  {...register(field.name)}
                />
              )
            })}
          </>
        )}
      </Box>
    </Box>
  )
}
