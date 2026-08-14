import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TEMPLATE_CATEGORY_META, WORKFLOW_TEMPLATES } from './templates'

const examplesDir = join(dirname(fileURLToPath(import.meta.url)), '../../public/examples')

describe('Custom Python template', () => {
  it('registers the Script gallery entry and ships process() example code', () => {
    expect(TEMPLATE_CATEGORY_META.script.label).toBe('Script')
    expect(WORKFLOW_TEMPLATES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'custom_python_sepia',
          category: 'script',
          path: '/examples/custom_python_sepia.json',
          steps: ['Load', 'Custom Python'],
        }),
      ]),
    )

    const doc = JSON.parse(
      readFileSync(join(examplesDir, 'custom_python_sepia.json'), 'utf8'),
    ) as { graph: { nodes: Array<{ type: string; params?: { code?: string } }> } }

    const custom = doc.graph.nodes.find((node) => node.type === 'custom_python')
    expect(custom?.params?.code).toMatch(/def process\s*\(/)
  })
})
