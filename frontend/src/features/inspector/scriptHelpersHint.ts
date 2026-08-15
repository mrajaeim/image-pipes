/** Catalog of Image Pipes helpers available inside custom / user scripts. */

export type ScriptHelperDoc = {
  signature: string
  summary: string
  detail: string
}

export const SCRIPT_HELPERS: ScriptHelperDoc[] = [
  {
    signature: 'log(*args)',
    summary: 'Write a line to the Script log panel',
    detail:
      'Arguments are joined with spaces. NumPy arrays render as shape and dtype ' +
      '(e.g. ndarray(shape=(H, W, C), dtype=uint8)). Long strings are truncated.',
  },
]

export const SCRIPT_HELPERS_TAGLINE =
  'Debug helpers you can call from process(image, seed=0)'

export const SCRIPT_HELPERS_FOOTNOTE =
  'More helpers will appear here as we expand the script runtime.'
