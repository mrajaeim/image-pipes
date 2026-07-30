/** Port data-type colors and connection rules for multi-target graphs. */

export const PORT_TYPE_COLORS: Record<string, string> = {
  image: '#7dcea0',
  mask: '#5dade2',
  bboxes: '#f5b041',
  keypoints: '#af7ac5',
}

export const IMAGE_LIKE_PORT_TYPES = new Set(['image', 'mask'])

export function portTypeColor(dataType: string, fallback = '#95a5a6'): string {
  return PORT_TYPE_COLORS[dataType] ?? fallback
}

export function portsCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true
  // Allow wiring a grayscale image into a mask port as a convenience.
  if (sourceType === 'image' && targetType === 'mask') return true
  return false
}

export function isImageLikePort(dataType: string): boolean {
  return IMAGE_LIKE_PORT_TYPES.has(dataType)
}
