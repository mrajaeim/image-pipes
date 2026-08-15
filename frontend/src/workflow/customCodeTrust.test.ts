import { describe, expect, it } from 'vitest'
import {
  computeCustomCodeHash,
  graphHasCustomCode,
  isCustomCodeTrusted,
  listCustomCodeNodes,
  truncateCodePreview,
  userScriptCodeKey,
} from './customCodeTrust'
import { trustNode } from '../test/customPythonFixtures'

describe('customCodeTrust helpers', () => {
  it('detects and sorts custom_python and user_script nodes', () => {
    const nodes = [
      trustNode('z-1', 'custom_python', 'a'),
      trustNode('a-1', 'user_script.script_001', undefined, 2),
      trustNode('mid', 'gaussian_blur'),
    ]
    expect(graphHasCustomCode(nodes)).toBe(true)
    expect(graphHasCustomCode([trustNode('x', 'load_image')])).toBe(false)
    expect(listCustomCodeNodes(nodes).map((n) => n.id)).toEqual(['a-1', 'z-1'])
  })

  it('fingerprints inline code and user script type+version+code', () => {
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

    const scriptNodes = [trustNode('u-1', 'user_script.script_001', undefined, 1)]
    const codes = {
      [userScriptCodeKey('user_script.script_001', 1)]: 'def process(image, seed=0):\n  return image\n',
    }
    expect(computeCustomCodeHash(scriptNodes)).toBeNull()
    expect(isCustomCodeTrusted(scriptNodes, 'deadbeef', {})).toBe(false)
    const scriptHash = computeCustomCodeHash(scriptNodes, codes)
    expect(scriptHash).not.toBeNull()
    expect(isCustomCodeTrusted(scriptNodes, scriptHash, codes)).toBe(true)
    expect(
      computeCustomCodeHash(scriptNodes, {
        [userScriptCodeKey('user_script.script_001', 1)]: 'changed',
      }),
    ).not.toBe(scriptHash)
  })

  it('truncates long code previews', () => {
    const preview = truncateCodePreview('a'.repeat(200), 40)
    expect(preview).toHaveLength(40)
    expect(preview.endsWith('…')).toBe(true)
  })
})
