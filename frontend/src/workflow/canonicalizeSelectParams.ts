import type { NodeMetadata } from '../types'
import zh from '../i18n/zh-CN.json'

const labels: Record<string, string> = zh

/** Resolve persisted select labels against the options of their own parameter. */
export function canonicalizeSelectParams(
  meta: NodeMetadata,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const canonical = { ...params }
  for (const field of meta.params) {
    if (field.type !== 'select' || !field.options || !Object.hasOwn(params, field.name)) continue
    const value = params[field.name]
    if (typeof value === 'string' && field.options.includes(value)) continue
    const matches = field.options.filter((option) =>
      Object.hasOwn(labels, option) && labels[option] === value,
    )
    if (matches.length !== 1) {
      throw new Error(`Invalid select parameter ${meta.type}.${field.name}: ${JSON.stringify(value)}`)
    }
    canonical[field.name] = matches[0]
  }
  return canonical
}
