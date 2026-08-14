/** Custom Python trust fingerprint helpers (session-only; not persisted in workflow JSON). */

export const CUSTOM_PYTHON_TYPE = 'custom_python'

export type CustomCodeNodeLike = {
  id: string
  data: {
    type: string
    label?: string
    params: Record<string, unknown>
  }
}

/** Stable non-cryptographic hash for code fingerprints. */
export function hashString(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function listCustomPythonNodes(nodes: CustomCodeNodeLike[]): CustomCodeNodeLike[] {
  return nodes
    .filter((node) => node.data.type === CUSTOM_PYTHON_TYPE)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function graphHasCustomCode(nodes: CustomCodeNodeLike[]): boolean {
  return nodes.some((node) => node.data.type === CUSTOM_PYTHON_TYPE)
}

/** Hash of all custom_python code params, or null if none present. */
export function computeCustomCodeHash(nodes: CustomCodeNodeLike[]): string | null {
  const parts: string[] = []
  for (const node of listCustomPythonNodes(nodes)) {
    const code = String(node.data.params.code ?? '')
    parts.push(`${node.id}\0${code}`)
  }
  if (parts.length === 0) return null
  return hashString(parts.join('\n'))
}

export function isCustomCodeTrusted(
  nodes: CustomCodeNodeLike[],
  trustedHash: string | null,
): boolean {
  const hash = computeCustomCodeHash(nodes)
  if (hash === null) return true
  return trustedHash === hash
}

export function truncateCodePreview(code: string, max = 120): string {
  const flat = code.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}
