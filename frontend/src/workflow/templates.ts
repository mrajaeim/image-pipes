export type WorkflowTemplate = {
  id: string
  name: string
  description: string
  /** Public URL path under /examples/ */
  path: string
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'blur_canny',
    name: 'Blur & Canny',
    description: 'Load Lena, blur, then extract Canny edges.',
    path: '/examples/blur_canny.json',
  },
  {
    id: 'hist_equalize',
    name: 'Hist Equalize',
    description: 'Grayscale + histogram equalize for OCR / documents.',
    path: '/examples/hist_equalize.json',
  },
  {
    id: 'morphology_cleanup',
    name: 'Morphology Cleanup',
    description: 'Otsu threshold then morphological open to clean noise.',
    path: '/examples/morphology_cleanup.json',
  },
  {
    id: 'contour_detect',
    name: 'Contour Detect',
    description: 'Threshold then find contours for structure analysis.',
    path: '/examples/contour_detect.json',
  },
  {
    id: 'albumentations_augment',
    name: 'Albu Augment',
    description: 'Annotations + color jitter + flip with synced bboxes/keypoints.',
    path: '/examples/albumentations_augment.json',
  },
  {
    id: 'hsv_color_mask',
    name: 'HSV Color Mask',
    description: 'HSV in-range mask then apply to the original image.',
    path: '/examples/hsv_color_mask.json',
  },
  {
    id: 'clahe_sharpen',
    name: 'CLAHE & Sharpen',
    description: 'Local contrast (CLAHE) followed by sharpening.',
    path: '/examples/clahe_sharpen.json',
  },
  {
    id: 'kmeans_palette',
    name: 'K-Means Palette',
    description: 'Quantize colors with k-means for a compact palette.',
    path: '/examples/kmeans_palette.json',
  },
]
