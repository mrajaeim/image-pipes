export type TemplateCategory =
  | 'edges'
  | 'enhance'
  | 'segment'
  | 'structure'
  | 'augment'
  | 'color'

export type WorkflowTemplate = {
  id: string
  name: string
  description: string
  /** Public URL path under /examples/ */
  path: string
  category: TemplateCategory
  /** Short pipeline step labels shown in the gallery tile. */
  steps: string[]
}

export const TEMPLATE_CATEGORY_META: Record<
  TemplateCategory,
  { label: string; accent: string }
> = {
  edges: { label: 'Edges', accent: '#e67e22' },
  enhance: { label: 'Enhance', accent: '#5dade2' },
  segment: { label: 'Segment', accent: '#48c9b0' },
  structure: { label: 'Structure', accent: '#af7ac5' },
  augment: { label: 'Augment', accent: '#e74c3c' },
  color: { label: 'Color', accent: '#f5b041' },
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'blur_canny',
    name: 'Blur & Canny',
    description: 'Load Lena, blur, then extract Canny edges.',
    path: '/examples/blur_canny.json',
    category: 'edges',
    steps: ['Load', 'Blur', 'Canny'],
  },
  {
    id: 'hist_equalize',
    name: 'Hist Equalize',
    description: 'Grayscale + histogram equalize for OCR / documents.',
    path: '/examples/hist_equalize.json',
    category: 'enhance',
    steps: ['Load', 'Gray', 'Equalize'],
  },
  {
    id: 'morphology_cleanup',
    name: 'Morphology Cleanup',
    description: 'Otsu threshold then morphological open to clean noise.',
    path: '/examples/morphology_cleanup.json',
    category: 'segment',
    steps: ['Load', 'Gray', 'Otsu', 'Open'],
  },
  {
    id: 'contour_detect',
    name: 'Contour Detect',
    description: 'Threshold then find contours for structure analysis.',
    path: '/examples/contour_detect.json',
    category: 'structure',
    steps: ['Load', 'Thresh', 'Contours'],
  },
  {
    id: 'albumentations_augment',
    name: 'Albu Augment',
    description: 'Annotations + color jitter + flip with synced bboxes/keypoints.',
    path: '/examples/albumentations_augment.json',
    category: 'augment',
    steps: ['Load', 'Annotate', 'Jitter', 'Flip'],
  },
  {
    id: 'hsv_color_mask',
    name: 'HSV Color Mask',
    description: 'HSV in-range mask then apply to the original image.',
    path: '/examples/hsv_color_mask.json',
    category: 'segment',
    steps: ['Load', 'HSV', 'In Range', 'Mask'],
  },
  {
    id: 'clahe_sharpen',
    name: 'CLAHE & Sharpen',
    description: 'Local contrast (CLAHE) followed by sharpening.',
    path: '/examples/clahe_sharpen.json',
    category: 'enhance',
    steps: ['Load', 'CLAHE', 'Sharpen'],
  },
  {
    id: 'kmeans_palette',
    name: 'K-Means Palette',
    description: 'Quantize colors with k-means for a compact palette.',
    path: '/examples/kmeans_palette.json',
    category: 'color',
    steps: ['Load', 'K-Means'],
  },
]
