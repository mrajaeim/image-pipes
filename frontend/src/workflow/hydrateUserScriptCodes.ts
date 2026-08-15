/** Fetch and cache on-disk user script sources for trust fingerprints. */

import { getUserScriptCode } from '../api/userScripts'
import { useGraphStore } from '../store/graphStore'
import {
  isUserScriptType,
  scriptIdFromType,
  userScriptCodeKey,
  type CustomCodeNodeLike,
} from './customCodeTrust'

export async function hydrateUserScriptCodes(options?: {
  nodes?: CustomCodeNodeLike[]
  /** When true, mark the graph trusted once all sources are cached. */
  autoTrust?: boolean
}): Promise<void> {
  const state = useGraphStore.getState()
  const nodes = options?.nodes ?? state.nodes
  const missing: { type: string; scriptId: string; version: number }[] = []

  for (const node of nodes) {
    if (!isUserScriptType(node.data.type)) continue
    const scriptId = scriptIdFromType(node.data.type)
    if (!scriptId) continue
    const version = Number(node.data.params.version ?? 1)
    const key = userScriptCodeKey(node.data.type, version)
    if (state.userScriptCodes[key] !== undefined) continue
    missing.push({ type: node.data.type, scriptId, version })
  }

  if (missing.length === 0) {
    if (options?.autoTrust) {
      state.trustCustomCode()
    }
    return
  }

  await Promise.all(
    missing.map(async ({ type, scriptId, version }) => {
      const { code } = await getUserScriptCode(scriptId, version)
      useGraphStore.getState().cacheUserScriptCode(type, version, code)
    }),
  )

  if (options?.autoTrust) {
    useGraphStore.getState().trustCustomCode()
  }
}
