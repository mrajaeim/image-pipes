import { Box, ImageList, ImageListItem, ImageListItemBar, Typography } from '@mui/material'
import { useGraphStore } from '../../store/graphStore'

export function PreviewGrid() {
  const previews = useGraphStore((s) => s.previews)

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Previews
      </Typography>
      {previews.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Execute a pipeline to see intermediate and final images.
        </Typography>
      ) : (
        <ImageList cols={3} gap={8}>
          {previews.map((preview, index) => (
            <ImageListItem key={`${preview.nodeId}-${preview.sampleIndex}-${index}`}>
              <img
                src={`data:image/png;base64,${preview.imageB64}`}
                alt={`${preview.nodeId} sample ${preview.sampleIndex}`}
                loading="lazy"
                style={{ width: '100%', display: 'block', borderRadius: 4 }}
              />
              <ImageListItemBar
                title={preview.portId ? `${preview.nodeId}:${preview.portId}` : preview.nodeId}
                subtitle={`sample ${preview.sampleIndex}${preview.cacheHit ? ' · cache' : ''}`}
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}
    </Box>
  )
}
