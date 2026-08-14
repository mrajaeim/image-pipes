import { describe, expect, it } from 'vitest'
import {
  computeCustomCodeHash,
  graphHasCustomCode,
  isCustomCodeTrusted,
  listCustomPythonNodes,
  truncateCodePreview,
} from './customCodeTrust'
import { trustNode } from '../test/customPythonFixtures'

describe('customCodeTrust helpers', () => {
  it('detects and sorts custom_python nodes', () => {
    const nodes = [
      trustNode('z-1', 'custom_python', 'a'),
      trustNode('a-1', 'custom_python', 'b'),
      trustNode('mid', 'gaussian_blur'),
    ]
    expect(graphHasCustomCode(nodes)).toBe(true)
    expect(graphHasCustomCode([trustNode('x', 'load_image')])).toBe(false)
    expect(listCustomPythonNodes(nodes).map((n) => n.id)).toEqual(['a-1', 'z-1'])
  })

  it('fingerprints code and treats matching hash as trusted', () => {
    const nodes = [trustNode('c-1', 'custom_python', 'return image')]
    const hash = computeCustomCodeHash(nodes)

    expect(computeCustomCodeHash([trustNode('x', 'load_image')])).toBeNull()
    expect(hash).toBe(computeCustomCodeHash(nodes))
    expect(hash).not.toBe(
      computeCustomCodeHash([trustNode('c-1', 'custom_python', 'return image * 2')]),
    )
    expect(isCustomCodeTrusted(nodes, null)).toBe(false)
    expect(isCustomCodeTrusted(nodes, hash)).toBe(true)
    expect(isCustomCodeTrusted([trustNode('x', 'load_image')], null)).toBe(true)
  })

  it('truncates long code previews', () => {
    const preview = truncateCodePreview('a'.repeat(200), 40)
    expect(preview).toHaveLength(40)
    expect(preview.endsWith('…')).toBe(true)
  })
})
