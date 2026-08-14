import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { useGraphStore } from '../../store/graphStore'
import type { GraphNodeData, NodeMetadata } from '../../types'
import { NodeInspector } from './NodeInspector'

const sharpenMeta: NodeMetadata = {
  type: 'sharpen',
  label: 'Sharpen',
  category: 'filters',
  description: 'Sharpen filter',
  ports: [],
  params: [
    {
      name: 'amount',
      label: 'Amount',
      type: 'number',
      default: 1.0,
      minimum: 0.1,
      maximum: 5.0,
      step: 0.1,
    },
    {
      name: 'kernel',
      label: 'Kernel',
      type: 'select',
      default: 'laplacian',
      options: ['laplacian', 'unsharp'],
    },
  ],
  stochastic: false,
}

const blurMeta: NodeMetadata = {
  type: 'gaussian_blur',
  label: 'Gaussian Blur',
  category: 'filters',
  description: 'Gaussian blur',
  ports: [],
  params: [
    {
      name: 'sigma',
      label: 'Sigma',
      type: 'number',
      default: 0,
      minimum: 0,
      maximum: 20,
      step: 0.1,
    },
  ],
  stochastic: false,
}

function makeNode(
  id: string,
  meta: NodeMetadata,
  params: Record<string, unknown>,
): Node<GraphNodeData> {
  return {
    id,
    type: 'pipeline',
    position: { x: 0, y: 0 },
    data: {
      type: meta.type,
      label: meta.label,
      params,
      category: meta.category,
      ports: meta.ports,
    },
  }
}

function seedStore(nodes: Node<GraphNodeData>[], selectedNodeId: string | null) {
  useGraphStore.setState({
    nodes,
    edges: [],
    selectedNodeId,
    nodeCatalog: [sharpenMeta, blurMeta],
  })
}

function nodeParams(nodeId: string) {
  const node = useGraphStore.getState().nodes.find((item) => item.id === nodeId)
  return node?.data.params ?? {}
}

async function chooseSelectOption(label: string, option: string) {
  const user = userEvent.setup()
  await user.click(screen.getByLabelText(label))
  const listbox = await screen.findByRole('listbox')
  await user.click(within(listbox).getByRole('option', { name: option }))
}

async function expectSelectValue(label: string, value: string) {
  await waitFor(() => {
    expect(screen.getByLabelText(label)).toHaveTextContent(value)
  })
}

describe('NodeInspector select param sync', () => {
  beforeEach(() => {
    seedStore(
      [
        makeNode('sharpen-a', sharpenMeta, { amount: 1.0, kernel: 'laplacian' }),
        makeNode('sharpen-b', sharpenMeta, { amount: 1.0, kernel: 'laplacian' }),
        makeNode('blur-1', blurMeta, { sigma: 0 }),
      ],
      'sharpen-a',
    )
  })

  it('keeps select value when switching to another node type and back', async () => {
    const user = userEvent.setup()
    render(<NodeInspector />)

    await expectSelectValue('Kernel', 'laplacian')

    await chooseSelectOption('Kernel', 'unsharp')
    expect(nodeParams('sharpen-a').kernel).toBe('unsharp')
    await expectSelectValue('Kernel', 'unsharp')

    useGraphStore.getState().selectNode('blur-1')
    const sigma = await screen.findByLabelText('Sigma')
    await user.clear(sigma)
    await user.type(sigma, '2')
    expect(nodeParams('blur-1').sigma).toBe(2)

    useGraphStore.getState().selectNode('sharpen-a')
    await expectSelectValue('Kernel', 'unsharp')
    expect(nodeParams('sharpen-a').kernel).toBe('unsharp')
  })

  it('keeps per-node select values when switching between same-type nodes', async () => {
    render(<NodeInspector />)

    await chooseSelectOption('Kernel', 'unsharp')
    expect(nodeParams('sharpen-a').kernel).toBe('unsharp')
    expect(nodeParams('sharpen-b').kernel).toBe('laplacian')

    useGraphStore.getState().selectNode('sharpen-b')
    await expectSelectValue('Kernel', 'laplacian')

    await chooseSelectOption('Kernel', 'laplacian')
    expect(nodeParams('sharpen-b').kernel).toBe('laplacian')
    expect(nodeParams('sharpen-a').kernel).toBe('unsharp')

    useGraphStore.getState().selectNode('sharpen-a')
    await expectSelectValue('Kernel', 'unsharp')

    useGraphStore.getState().selectNode('sharpen-b')
    await expectSelectValue('Kernel', 'laplacian')
  })

  it('preserves select and number fields after deselect and reselect', async () => {
    const user = userEvent.setup()
    render(<NodeInspector />)

    await chooseSelectOption('Kernel', 'unsharp')

    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '2')
    expect(nodeParams('sharpen-a').amount).toBe(2)
    expect(nodeParams('sharpen-a').kernel).toBe('unsharp')

    useGraphStore.getState().selectNode(null)
    expect(await screen.findByText(/Click a node on the canvas/i)).toBeInTheDocument()

    useGraphStore.getState().selectNode('sharpen-a')
    await expectSelectValue('Kernel', 'unsharp')
    expect(screen.getByLabelText('Amount')).toHaveValue(2)
    expect(nodeParams('sharpen-a')).toMatchObject({ kernel: 'unsharp', amount: 2 })
  })
})
