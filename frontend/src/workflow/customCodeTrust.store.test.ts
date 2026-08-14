import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../store/graphStore'
import { computeCustomCodeHash } from './customCodeTrust'
import {
  IDENTITY_CODE,
  customPythonMeta,
  pipelineCustomNode,
  resetCustomCodeStore,
} from '../test/customPythonFixtures'

const store = () => useGraphStore.getState()

describe('graphStore custom code trust', () => {
  beforeEach(() => resetCustomCodeStore())

  it('auto-trusts palette add and local code edits', () => {
    store().addNodeFromType(customPythonMeta, { x: 10, y: 20 })
    expect(store().isCustomCodeTrusted()).toBe(true)
    expect(store().trustedCustomCodeHash).toBe(computeCustomCodeHash(store().nodes))

    resetCustomCodeStore({
      nodes: [pipelineCustomNode(IDENTITY_CODE)],
      trustedCustomCodeHash: null,
    })
    expect(store().isCustomCodeTrusted()).toBe(false)

    store().updateNodeParams('custom-1', { code: 'return image[:, :, ::-1]' })
    expect(store().isCustomCodeTrusted()).toBe(true)
  })

  it('clears trust when loading a workflow that includes custom code', () => {
    store().addNodeFromType(customPythonMeta, { x: 0, y: 0 })
    expect(store().isCustomCodeTrusted()).toBe(true)

    store().loadWorkflow({
      version: 1,
      name: 'imported',
      seed: 0,
      iterationCount: 1,
      graph: {
        nodes: [
          { id: 'load-1', type: 'load_image', params: {}, position: { x: 0, y: 0 } },
          {
            id: 'custom-1',
            type: 'custom_python',
            params: { code: IDENTITY_CODE },
            position: { x: 220, y: 0 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'load-1',
            source_port: 'image',
            target: 'custom-1',
            target_port: 'image',
          },
        ],
      },
    })

    expect(store().graphHasCustomCode()).toBe(true)
    expect(store().trustedCustomCodeHash).toBeNull()
    expect(store().isCustomCodeTrusted()).toBe(false)
  })

  it('sets trust fingerprint and dialog pending-run flags', () => {
    resetCustomCodeStore({
      nodes: [pipelineCustomNode('return image')],
      trustedCustomCodeHash: null,
    })
    store().trustCustomCode()
    expect(store().isCustomCodeTrusted()).toBe(true)

    store().openCustomCodeTrustDialog({ targetNodeId: 'n1' }, true)
    expect(store()).toMatchObject({
      customCodeTrustDialogOpen: true,
      pendingRunAfterTrust: true,
      pendingRunOptions: { targetNodeId: 'n1' },
    })

    store().closeCustomCodeTrustDialog()
    expect(store().customCodeTrustDialogOpen).toBe(false)

    store().openCustomCodeTrustDialog(undefined, false)
    expect(store().pendingRunAfterTrust).toBe(false)
  })
})
