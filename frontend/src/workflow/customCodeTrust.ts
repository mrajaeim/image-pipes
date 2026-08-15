/** Custom code trust fingerprint helpers (session-only; not persisted in workflow JSON). */

export const CUSTOM_PYTHON_TYPE = 'custom_python'
export const USER_SCRIPT_TYPE_PREFIX = 'user_script.'

export type CustomCodeNodeLike = {
  id: string
  data: {
    type: string
    label?: string
    params: Record<string, unknown>
  }
}

/** Session cache of on-disk user script sources keyed by `type@version`. */
export type UserScriptCodeMap = Record<string, string>

/** Stable non-cryptographic hash for code fingerprints. */
export function hashString(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function isUserScriptType(type: string): boolean {
  return type.startsWith(USER_SCRIPT_TYPE_PREFIX)
}

export function isCustomCodeType(type: string): boolean {
  return type === CUSTOM_PYTHON_TYPE || isUserScriptType(type)
}

export function userScriptCodeKey(type: string, version: number | string): string {
  return `${type}@${version}`
}

export function scriptIdFromType(type: string): string | null {
  if (!isUserScriptType(type)) return null
  return type.slice(USER_SCRIPT_TYPE_PREFIX.length) || null
}

export function listCustomCodeNodes(nodes: CustomCodeNodeLike[]): CustomCodeNodeLike[] {
  return nodes
    .filter((node) => isCustomCodeType(node.data.type))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** @deprecated Prefer listCustomCodeNodes */
export function listCustomPythonNodes(nodes: CustomCodeNodeLike[]): CustomCodeNodeLike[] {
  return listCustomCodeNodes(nodes)
}

export function graphHasCustomCode(nodes: CustomCodeNodeLike[]): boolean {
  return nodes.some((node) => isCustomCodeType(node.data.type))
}

/**
 * Hash of all custom / user-script code. Returns null when the graph has no
 * custom code, or when a user_script node's source is missing from the cache.
 */
export function computeCustomCodeHash(
  nodes: CustomCodeNodeLike[],
  userScriptCodes: UserScriptCodeMap = {},
): string | null {
  const customNodes = listCustomCodeNodes(nodes)
  if (customNodes.length === 0) return null

  const parts: string[] = []
  for (const node of customNodes) {
    if (node.data.type === CUSTOM_PYTHON_TYPE) {
      const code = String(node.data.params.code ?? '')
      parts.push(`${node.id}\0${CUSTOM_PYTHON_TYPE}\0${code}`)
      continue
    }
    const version = Number(node.data.params.version ?? 1)
    const key = userScriptCodeKey(node.data.type, version)
    const code = userScriptCodes[key]
    if (code === undefined) return null
    parts.push(`${node.id}\0${node.data.type}\0${version}\0${code}`)
  }
  return hashString(parts.join('\n'))
}

export function isCustomCodeTrusted(
  nodes: CustomCodeNodeLike[],
  trustedHash: string | null,
  userScriptCodes: UserScriptCodeMap = {},
): boolean {
  if (!graphHasCustomCode(nodes)) return true
  const hash = computeCustomCodeHash(nodes, userScriptCodes)
  if (hash === null) return false
  return trustedHash === hash
}

export function truncateCodePreview(code: string, max = 120): string {
  const flat = code.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}

export function resolveCustomCodePreview(
  node: CustomCodeNodeLike,
  userScriptCodes: UserScriptCodeMap = {},
): string {
  if (node.data.type === CUSTOM_PYTHON_TYPE) {
    return String(node.data.params.code ?? '')
  }
  const version = Number(node.data.params.version ?? 1)
  return userScriptCodes[userScriptCodeKey(node.data.type, version)] ?? '(loading script…)'
}
