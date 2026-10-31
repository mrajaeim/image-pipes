import { tr, useLocale } from '../../i18n'
import { Box, ImageList, ImageListItem, ImageListItemBar, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'

export function PreviewGrid() {
  useLocale()
  const previews = useGraphStore((s) => s.previews)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography
        variant="subtitle1"
        sx={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700, px: 2, pt: 1.5, pb: 0.5 }}
      >{tr("Run Results")}</Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, pb: 2 }}>
        {previews.length === 0 ? (
          <Typography sx={{ color: 'rgba(244,241,234,0.55)', fontSize: 13, lineHeight: 1.5 }}>{tr("Execute a pipeline to collect intermediate and final images here.")}</Typography>
        ) : (
          <ImageList cols={2} gap={8}>
            {previews.map((preview, index) => (
              <ImageListItem key={`${preview.nodeId}-${preview.sampleIndex}-${index}`}>
                <img
                  src={`data:image/png;base64,${preview.imageB64}`}
                  alt={tr('{{v0}} sample {{v1}}', { v0: preview.nodeId, v1: preview.sampleIndex })}
                  loading="lazy"
                  style={{ width: '100%', display: 'block', borderRadius: 4 }}
                />
                <ImageListItemBar
                  title={preview.portId ? `${preview.nodeId}:${preview.portId}` : preview.nodeId}
                  subtitle={tr('sample {{v0}}{{v1}}', { v0: preview.sampleIndex, v1: preview.cacheHit ? tr(' · cache') : '' })}
                />
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Box>
    </Box>
  )
}
