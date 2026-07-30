import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type BBoxRow = {
  xMin: string
  yMin: string
  xMax: string
  yMax: string
  label: string
}

type KeypointRow = {
  x: string
  y: string
}

type AnnotationsParamsProps = {
  bboxesJson: string
  keypointsJson: string
  onChange: (next: { bboxes_json: string; keypoints_json: string }) => void
}

function parseBBoxes(raw: string): BBoxRow[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ xMin: '10', yMin: '10', xMax: '100', yMax: '80', label: 'object' }]
    }
    return parsed.map((item) => {
      const row = Array.isArray(item) ? item : []
      return {
        xMin: String(row[0] ?? 0),
        yMin: String(row[1] ?? 0),
        xMax: String(row[2] ?? 0),
        yMax: String(row[3] ?? 0),
        label: String(row[4] ?? 'object'),
      }
    })
  } catch {
    return [{ xMin: '10', yMin: '10', xMax: '100', yMax: '80', label: 'object' }]
  }
}

function parseKeypoints(raw: string): KeypointRow[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ x: '40', y: '40' }]
    }
    return parsed.map((item) => {
      const row = Array.isArray(item) ? item : []
      return { x: String(row[0] ?? 0), y: String(row[1] ?? 0) }
    })
  } catch {
    return [{ x: '40', y: '40' }]
  }
}

function serializeBBoxes(rows: BBoxRow[]): string {
  const payload = rows.map((row) => [
    Number(row.xMin),
    Number(row.yMin),
    Number(row.xMax),
    Number(row.yMax),
    row.label || 'object',
  ])
  return JSON.stringify(payload)
}

function serializeKeypoints(rows: KeypointRow[]): string {
  const payload = rows.map((row) => [Number(row.x), Number(row.y)])
  return JSON.stringify(payload)
}

export function AnnotationsParams({
  bboxesJson,
  keypointsJson,
  onChange,
}: AnnotationsParamsProps) {
  const [bboxes, setBboxes] = useState(() => parseBBoxes(bboxesJson))
  const [keypoints, setKeypoints] = useState(() => parseKeypoints(keypointsJson))
  const [advanced, setAdvanced] = useState(false)

  const commit = (nextBoxes: BBoxRow[], nextPoints: KeypointRow[]) => {
    setBboxes(nextBoxes)
    setKeypoints(nextPoints)
    onChange({
      bboxes_json: serializeBBoxes(nextBoxes),
      keypoints_json: serializeKeypoints(nextPoints),
    })
  }

  const jsonPreview = useMemo(
    () => ({
      bboxes: serializeBBoxes(bboxes),
      keypoints: serializeKeypoints(keypoints),
    }),
    [bboxes, keypoints],
  )

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(244,241,234,0.65)' }}>
          Pascal VOC bboxes · [x_min, y_min, x_max, y_max, label]
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {bboxes.map((row, index) => (
            <Stack
              key={`bbox-${index}`}
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center' }}
            >
              {(['xMin', 'yMin', 'xMax', 'yMax', 'label'] as const).map((key) => (
                <TextField
                  key={key}
                  size="small"
                  label={key}
                  value={row[key]}
                  onChange={(event) => {
                    const next = bboxes.map((item, i) =>
                      i === index ? { ...item, [key]: event.target.value } : item,
                    )
                    commit(next, keypoints)
                  }}
                  sx={{ flex: key === 'label' ? 1.2 : 1 }}
                />
              ))}
              <IconButton
                size="small"
                aria-label="Remove bbox"
                onClick={() => commit(bboxes.filter((_, i) => i !== index), keypoints)}
                disabled={bboxes.length <= 1}
              >
                ×
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              commit(
                [...bboxes, { xMin: '0', yMin: '0', xMax: '50', yMax: '50', label: 'object' }],
                keypoints,
              )
            }
          >
            Add bbox
          </Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(244,241,234,0.65)' }}>
          Keypoints · [x, y]
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {keypoints.map((row, index) => (
            <Stack
              key={`kp-${index}`}
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center' }}
            >
              <TextField
                size="small"
                label="x"
                value={row.x}
                onChange={(event) => {
                  const next = keypoints.map((item, i) =>
                    i === index ? { ...item, x: event.target.value } : item,
                  )
                  commit(bboxes, next)
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="y"
                value={row.y}
                onChange={(event) => {
                  const next = keypoints.map((item, i) =>
                    i === index ? { ...item, y: event.target.value } : item,
                  )
                  commit(bboxes, next)
                }}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                aria-label="Remove keypoint"
                onClick={() => commit(bboxes, keypoints.filter((_, i) => i !== index))}
                disabled={keypoints.length <= 1}
              >
                ×
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            variant="outlined"
            onClick={() => commit(bboxes, [...keypoints, { x: '0', y: '0' }])}
          >
            Add keypoint
          </Button>
        </Stack>
      </Box>

      <Button size="small" onClick={() => setAdvanced((value) => !value)}>
        {advanced ? 'Hide JSON' : 'Show JSON'}
      </Button>
      {advanced && (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="BBoxes JSON"
            multiline
            minRows={2}
            value={jsonPreview.bboxes}
            onChange={(event) => {
              const next = parseBBoxes(event.target.value)
              commit(next, keypoints)
            }}
          />
          <TextField
            size="small"
            label="Keypoints JSON"
            multiline
            minRows={2}
            value={jsonPreview.keypoints}
            onChange={(event) => {
              const next = parseKeypoints(event.target.value)
              commit(bboxes, next)
            }}
          />
        </Stack>
      )}
    </Stack>
  )
}
