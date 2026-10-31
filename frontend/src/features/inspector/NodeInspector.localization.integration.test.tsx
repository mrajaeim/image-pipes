import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { NodeMetadata } from '../../types'
import { initializeLanguage, metadataText, setLocale } from '../../i18n'
import { useGraphStore } from '../../store/graphStore'
import { canonicalizeSelectParams } from '../../workflow/canonicalizeSelectParams'
import { parseWorkflowJson } from '../../workflow/io'
import { loadWorkflowSession, saveWorkflowSession } from '../../workflow/persist'
import { getWorkflow, upsertWorkflow } from '../../workflow/workflowLibrary'
import { NodeInspector } from './NodeInspector'

const backend = process.env.IMAGE_PIPES_VERIFY_URL
let catalog: NodeMetadata[]

async function request(path: string, body?: unknown) {
  const response = await fetch(`${backend}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.json()
}

function metadata(type: string) {
  const meta = catalog.find((node) => node.type === type)
  if (!meta) throw new Error(`Missing backend node: ${type}`)
  return meta
}

function defaults(meta: NodeMetadata) {
  return Object.fromEntries(meta.params.map((field) => [field.name, field.default]))
}

function selectNode(meta: NodeMetadata) {
  useGraphStore.setState({
    nodeCatalog: catalog,
    edges: [],
    nodes: [{
      id: 'selected', type: 'pipeline', position: { x: 0, y: 0 },
      data: { type: meta.type, label: meta.label, category: meta.category,
        ports: meta.ports, params: defaults(meta) },
    }],
    selectedNodeId: 'selected',
  })
}

describe.skipIf(!backend)('localized selects with the real Image Pipes backend', () => {
  beforeAll(async () => {
    catalog = await request('/api/nodes')
    await initializeLanguage()
  })

  beforeEach(async () => {
    await act(async () => setLocale('zh-CN'))
  })

  it('submits every generic select option as the backend token', async () => {
    const user = userEvent.setup()
    for (const meta of catalog) {
      const fields = meta.params.filter((field) => field.type === 'select' && field.options
        && field.name !== 'packaging')
      if (fields.length === 0) continue
      selectNode(meta)
      const view = render(<NodeInspector />)
      for (const field of fields) {
        for (const option of field.options!) {
          await user.click(screen.getByRole('combobox', { name: metadataText(field.label)! }))
          const listbox = await screen.findByRole('listbox')
          await user.click(within(listbox).getByRole('option', { name: metadataText(option)!, exact: true }))
          expect(useGraphStore.getState().toGraphPayload().nodes[0].params[field.name]).toBe(option)
        }
      }
      view.unmount()
    }
  }, 120000)

  it('resolves every persisted label within its own backend parameter', () => {
    let checked = 0
    for (const meta of catalog) {
      for (const field of meta.params) {
        if (field.type !== 'select' || !field.options) continue
        for (const option of field.options) {
          const label = metadataText(option, 'zh-CN')!
          const original = { ...defaults(meta), [field.name]: label }
          const resolved = canonicalizeSelectParams(meta, original)
          expect(resolved[field.name]).toBe(option)
          expect(original[field.name]).toBe(label)
          expect(canonicalizeSelectParams(meta, resolved)).toEqual(resolved)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('preserves the selected backend value through language changes', async () => {
    selectNode(metadata('adaptive_threshold'))
    render(<NodeInspector />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: '方法' }))
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: '均值', exact: true }))
    const graph = useGraphStore.getState().toGraphPayload()
    await act(async () => setLocale('en'))
    expect(screen.getByRole('combobox', { name: 'Method' })).toHaveTextContent('mean')
    expect(useGraphStore.getState().toGraphPayload()).toEqual(graph)
    await act(async () => setLocale('zh-CN'))
    expect(screen.getByRole('combobox', { name: '方法' })).toHaveTextContent('均值')
    expect(useGraphStore.getState().toGraphPayload()).toEqual(graph)
  })

  it('loads, saves, executes and exports a real sample pipeline with canonical parameters', async () => {
    const types = ['load_image', 'adaptive_threshold', 'threshold', 'morphology_ex']
    const graph = {
      nodes: types.map((type, index) => ({
        id: type, type, position: { x: index * 250, y: 0 }, params: defaults(metadata(type)),
      })),
      edges: types.slice(1).map((type, index) => ({
        id: `${index}`, source: types[index], target: type, source_port: 'image', target_port: 'image',
      })),
    }
    graph.nodes[0].params.sample = 'lena'
    const sample = await request('/api/assets/sample', {})
    graph.nodes[0].params.asset_batch_id = sample.batch.id
    graph.nodes[1].params.method = metadataText('gaussian', 'zh-CN')!
    graph.nodes[1].params.type = metadataText('binary_inv', 'zh-CN')!
    graph.nodes[2].params.method = metadataText('otsu', 'zh-CN')!
    graph.nodes[3].params.op = metadataText('open', 'zh-CN')!
    const doc = parseWorkflowJson(JSON.stringify({
      version: 1, name: '参数映射验收', seed: 0, iterationCount: 1, graph,
    }))
    saveWorkflowSession(doc)
    useGraphStore.setState({ nodeCatalog: catalog })
    useGraphStore.getState().loadWorkflow(loadWorkflowSession()!.document)
    const canonical = useGraphStore.getState().toWorkflowDocument()
    expect(canonical.graph.nodes[1].params).toMatchObject({ method: 'gaussian', type: 'binary_inv' })
    expect(canonical.graph.nodes[2].params.method).toBe('otsu')
    expect(canonical.graph.nodes[3].params.op).toBe('open')
    const saved = upsertWorkflow(canonical)
    useGraphStore.getState().loadWorkflow(getWorkflow(saved.id)!)
    const payload = useGraphStore.getState().toGraphPayload()
    expect(payload).toEqual(canonical.graph)
    const executed = await request('/api/execute', { graph: payload, seed: 0, cache: false })
    expect(executed.order).toEqual(types)
    expect(executed.samples).toHaveLength(1)
    expect(Object.keys(executed.samples[0].previews)).toEqual(types)
    const exported = await request('/api/codegen', { graph: payload, seed: 0 })
    expect(exported.code).toContain('cv2.ADAPTIVE_THRESH_GAUSSIAN_C')
    expect(exported.code).toContain('cv2.THRESH_BINARY_INV')
    expect(exported.code).toContain('cv2.MORPH_OPEN')
  })

  it('rejects unrecognized select values and preserves text parameters', () => {
    const meta = metadata('adaptive_threshold')
    expect(() => canonicalizeSelectParams(meta, { method: '未知方法' })).toThrow('adaptive_threshold.method')
    expect(() => canonicalizeSelectParams(meta, { method: 1 })).toThrow('adaptive_threshold.method')
    const load = metadata('load_image')
    expect(canonicalizeSelectParams(load, { sample: '高斯', path: 'D:/中文路径/图像.png' }))
      .toEqual({ sample: '高斯', path: 'D:/中文路径/图像.png' })
  })
})
